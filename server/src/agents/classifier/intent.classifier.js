/**
 * Intent classifier — Phase 9.
 *
 * Two-layer classification strategy:
 *
 * Layer 1: Deterministic high-confidence rules.
 *   Catches obvious live-data intents BEFORE any LLM call.
 *   This ensures questions about "today's price" or "tomorrow's rain"
 *   are NEVER accidentally routed to general Granite which could fabricate
 *   live data.
 *
 * Layer 2: Granite structured classification for ambiguous queries.
 *   Sends the question to IBM Granite with a structured-output prompt.
 *   The response JSON is validated against the intent schema.
 *   If malformed, one retry is performed; if still invalid, a safe fallback
 *   is used.
 *
 * Safety invariants:
 *   - WEATHER and MARKET intents detected in layer 1 are never overridden.
 *   - Classifier output is validated before being trusted.
 *   - Granite chain-of-thought is suppressed in the classifier prompt.
 *   - On classifier failure, routing falls back to CLARIFICATION (not GENERAL)
 *     to avoid silent hallucination of live data.
 */
import { getAiProvider } from '../../providers/ai.provider.factory.js'
import { CLASSIFIER_SYSTEM_PROMPT, buildClassifierUserMessage } from './intent.prompt.js'
import { validateClassifierOutput, normalizeClassifierOutput } from './intent.schema.js'
import { INTENT, CONFIDENCE, LIVE_DATA_INTENTS } from '../intents.js'
import logger from '../../utils/logger.js'

// ── Deterministic Layer 1 rules ───────────────────────────────────────────────

/**
 * Weather-related keyword patterns.
 * If any match, route immediately to WEATHER.
 */
const WEATHER_PATTERNS = [
  /\b(rain|rainfall|raining)\b/i,
  /\b(weather|forecast|temperature|humidity|wind)\b/i,
  /\b(irrigat(e|ion|ing)).*(today|tomorrow|now|abhi)\b/i,
  /\b(today|tomorrow|now|abhi).*(irrigat(e|ion|ing)|water)\b/i,
  /\bwater.*(today|tomorrow)\b/i,
  /\b(spray.*today|spray.*tomorrow|spray.*this week)\b/i,
  /\b(today.*rain|tomorrow.*rain|this week.*rain)\b/i,
  /\b(imd|meteorolog)\b/i,
  /\b(monsoon.*forecast|forecast.*monsoon)\b/i,
  /\bkya aaj.*baarish\b/i,
  /\bkya kal.*baarish\b/i,
  // Phase 14: Hindi/Hinglish weather patterns
  /\b(baarish|barish|mausam|tapman|nami|aandhi|tufan)\b/i,
  /\b(baarish|barish|mausam)\b.*(aaj|kal|abhi|is hafte)\b/i,
  /\b(sinchai|pani)\b.*(kab|karna|karo|chahiye)\b/i,
  /\u092c\u093e\u0930\u093f\u0936/u, // बारिश (Devanagari: baarish)
  /\u092eानसून/u, // मानसून (Devanagari: monsoon)
]

/**
 * Market/price-related keyword patterns.
 * If any match, route immediately to MARKET.
 */
const MARKET_PATTERNS = [
  /\b(mandi|apmc|market price|mandibhav|market bhav)\b/i,
  /\b(today('?s)?|aaj (ka|ki|ke))\s+(price|bhav|rate|daam)\b/i,
  /\b(price|rate|bhav|daam)\s+(today|aaj|abhi|current)\b/i,
  /\bcurrent (price|rate|bhav)\b/i,
  /\b(tomato|potato|onion|wheat|rice|soybean|cotton|sugarcane|maize)\s+(price|rate|bhav)\b/i,
  /\bsell.*crop.*price\b/i,
  /\bprice.*sell.*crop\b/i,
  /\bkitna bhav\b/i,
  /\baj ka bhav\b/i,
  // Phase 14: Hindi/Hinglish market patterns
  /\b(gehu|gehun|dhan|makka|sarson|soyabin|kapas|pyaz|aloo|tamatar)\s+(bhav|daam|rate|price)\b/i,
  /\b(aaj ka|abhi ka|kal ka)\s+(bhav|daam|rate)\b/i,
  /\u092e\u0902\u0921\u0940/u,  // मंडी (Devanagari: mandi)
  /\u092d\u093e\u0935/u,        // भाव (Devanagari: bhav/price)
]

/**
 * Disease/symptom patterns — deterministic boost only (still goes through LLM).
 * These increase confidence but do not hard-route.
 */
const DISEASE_PATTERNS = [
  /\b(disease|pest|fungus|fungal|blight|rot|rust|mold|mould|wilt|viral|bacterial)\b/i,
  /\b(leaf|leaves|stem|root|fruit|pod)\s+(spot|spots|curl|yellow|brown|black|hole|lesion|damage)\b/i,
  /\b(brown spots?|yellow leaves?|black spots?|white spots?|wilting)\b/i,
  /\bmy (tomato|wheat|rice|potato|cotton|onion|maize|paddy)\b/i,
  /\b(diagnos|symptom|infect|attack|insect)\b/i,
]

/**
 * Knowledge base patterns — hints that the user wants document retrieval.
 */
const KNOWLEDGE_PATTERNS = [
  /\b(according to|as per|in the document|knowledge base|uploaded document)\b/i,
  /\b(recommend(ed)?|suggest(ed)?)\s+in\s+(the|your|available)\s+(document|guide|manual)\b/i,
]

/**
 * Crop recommendation hints — Hinglish/Hindi patterns.
 * These are soft signals passed to the LLM classifier for disambiguation.
 * They do NOT hard-route (unlike WEATHER/MARKET) because crop questions
 * require profile context to classify confidently.
 * Used only in buildClassifierUserMessage to boost crop intent confidence.
 */
export const CROP_RECOMMENDATION_HINTS = [
  /\b(konsi fasal|kaun si fasal|kya ugayein|kya lagayein)\b/i,
  /\bfasal\s+(chune|batao|suggest|recommend)\b/i,
  /\b(kharif|rabi|zaid)\s+(mein|ke liye)\s+(kaun|kya)\b/i,
  /\u092b\u0938\u0932/u,  // फसल (Devanagari: fasal/crop)
]

/**
 * Apply Layer 1 deterministic rules.
 *
 * @param {string} message - Farmer message
 * @returns {object|null} Classifier result or null if no deterministic match
 */
function applyDeterministicRules(message) {
  const weatherMatch = WEATHER_PATTERNS.some((p) => p.test(message))
  const marketMatch = MARKET_PATTERNS.some((p) => p.test(message))

  // Both weather + market → MULTI_INTENT
  if (weatherMatch && marketMatch) {
    return normalizeClassifierOutput({
      primaryIntent: INTENT.MULTI_INTENT,
      secondaryIntents: [INTENT.WEATHER, INTENT.MARKET],
      confidenceCategory: CONFIDENCE.HIGH,
      missingInformation: [],
      requiresLiveData: true,
      requiresKnowledgeRetrieval: false,
    })
  }

  if (weatherMatch) {
    return normalizeClassifierOutput({
      primaryIntent: INTENT.WEATHER,
      secondaryIntents: [],
      confidenceCategory: CONFIDENCE.HIGH,
      missingInformation: [],
      requiresLiveData: true,
      requiresKnowledgeRetrieval: false,
    })
  }

  if (marketMatch) {
    return normalizeClassifierOutput({
      primaryIntent: INTENT.MARKET,
      secondaryIntents: [],
      confidenceCategory: CONFIDENCE.HIGH,
      missingInformation: [],
      requiresLiveData: true,
      requiresKnowledgeRetrieval: false,
    })
  }

  return null
}

// ── Layer 2: LLM classification ──────────────────────────────────────────────

/**
 * Extract and parse JSON from a LLM response string.
 * The model may wrap the JSON in markdown code fences — strip them.
 *
 * @param {string} raw - Raw text from LLM
 * @returns {object|null} Parsed JSON or null if unparseable
 */
function extractJson(raw) {
  if (!raw) return null
  try {
    // Strip optional markdown fences
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    return JSON.parse(cleaned)
  } catch {
    // Try extracting the first JSON object found in the string
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {
        return null
      }
    }
    return null
  }
}

/**
 * Call LLM classifier and return validated classification.
 * Returns null on provider failure.
 *
 * @param {string} message
 * @param {object} farmerContext
 * @param {object} metadata
 * @returns {Promise<object|null>}
 */
async function callLlmClassifier(message, farmerContext, metadata) {
  const provider = getAiProvider()
  const userMessage = buildClassifierUserMessage(message, farmerContext)

  let aiResult
  try {
    aiResult = await provider.generate({
      messages: [{ role: 'user', content: userMessage }],
      systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
      parameters: {
        max_tokens: 300,
        temperature: 0.0,
        top_p: 1.0,
      },
      metadata,
    })
  } catch (err) {
    logger.warn('Intent classifier: LLM call failed', {
      requestId: metadata?.requestId,
      code: err.code ?? 'UNKNOWN',
    })
    return null
  }

  return extractJson(aiResult.content)
}

// ── Safe fallback ─────────────────────────────────────────────────────────────

/**
 * Build safe fallback classification when Granite classifier fails.
 *
 * If the message contains disease or knowledge patterns we can detect those.
 * Otherwise default to CLARIFICATION to avoid silent Granite hallucination.
 *
 * @param {string} message
 * @returns {object}
 */
function buildFallbackClassification(message) {
  const diseaseMatch = DISEASE_PATTERNS.some((p) => p.test(message))
  if (diseaseMatch) {
    return normalizeClassifierOutput({
      primaryIntent: INTENT.DISEASE,
      secondaryIntents: [],
      confidenceCategory: CONFIDENCE.LOW,
      missingInformation: [],
      requiresLiveData: false,
      requiresKnowledgeRetrieval: false,
    })
  }

  const knowledgeMatch = KNOWLEDGE_PATTERNS.some((p) => p.test(message))
  if (knowledgeMatch) {
    return normalizeClassifierOutput({
      primaryIntent: INTENT.KNOWLEDGE,
      secondaryIntents: [],
      confidenceCategory: CONFIDENCE.LOW,
      missingInformation: [],
      requiresLiveData: false,
      requiresKnowledgeRetrieval: true,
    })
  }

  // Very short or vague messages → CLARIFICATION
  if (message.trim().split(/\s+/).length <= 4) {
    return normalizeClassifierOutput({
      primaryIntent: INTENT.CLARIFICATION,
      secondaryIntents: [],
      confidenceCategory: CONFIDENCE.LOW,
      missingInformation: [],
      requiresLiveData: false,
      requiresKnowledgeRetrieval: false,
    })
  }

  // Default safe fallback to GENERAL
  return normalizeClassifierOutput({
    primaryIntent: INTENT.GENERAL,
    secondaryIntents: [],
    confidenceCategory: CONFIDENCE.LOW,
    missingInformation: [],
    requiresLiveData: false,
    requiresKnowledgeRetrieval: false,
  })
}

// ── Safety post-processing ────────────────────────────────────────────────────

/**
 * Safety check: if the LLM returned GENERAL for a known live-data query,
 * override it. This protects against the classifier degrading and accidentally
 * routing a "today's price" question to the general LLM.
 *
 * @param {object} classification - Classifier result
 * @param {string} message - Original farmer message
 * @returns {object} Possibly-corrected classification
 */
function applyPostClassificationSafety(classification, message) {
  // If we got GENERAL but message clearly needs live data, re-apply rules
  if (
    classification.primaryIntent === INTENT.GENERAL &&
    LIVE_DATA_INTENTS.has(classification.primaryIntent) === false
  ) {
    const deterministicResult = applyDeterministicRules(message)
    if (deterministicResult && LIVE_DATA_INTENTS.has(deterministicResult.primaryIntent)) {
      logger.warn('Intent classifier: LLM returned GENERAL for live-data query — overriding', {
        llmIntent: INTENT.GENERAL,
        overriddenTo: deterministicResult.primaryIntent,
      })
      return deterministicResult
    }
  }
  return classification
}

// ── Main classifier export ────────────────────────────────────────────────────

/**
 * Classify the farmer's message into an intent.
 *
 * @param {object} params
 * @param {string} params.message - Farmer message text
 * @param {object} [params.farmerContext={}] - Normalized farmer context
 * @param {object} [params.metadata={}] - Request metadata for logging
 * @returns {Promise<object>} Validated classifier result
 */
export async function classifyIntent({ message, farmerContext = {}, attachments = [], metadata = {} }) {
  const start = Date.now()

  // ── Layer 0: Attachment rules ─────────────────────────────────────────────
  if (attachments && attachments.some(a => a.type === 'image')) {
    logger.debug('Intent classified (image attachment)', {
      requestId: metadata?.requestId,
      intent: INTENT.DISEASE,
    })
    return normalizeClassifierOutput({
      primaryIntent: INTENT.DISEASE,
      secondaryIntents: [],
      confidenceCategory: CONFIDENCE.HIGH,
      missingInformation: [],
      requiresLiveData: false,
      requiresKnowledgeRetrieval: true,
    })
  }

  // ── Layer 1: Deterministic rules ──────────────────────────────────────────
  const deterministicResult = applyDeterministicRules(message)
  if (deterministicResult) {
    logger.debug('Intent classified (deterministic)', {
      requestId: metadata?.requestId,
      intent: deterministicResult.primaryIntent,
      durationMs: Date.now() - start,
    })
    return deterministicResult
  }

  // ── Layer 2: LLM classification ──────────────────────────────────────────
  logger.debug('Intent classifier: calling LLM', { requestId: metadata?.requestId })

  let parsed = await callLlmClassifier(message, farmerContext, metadata)

  if (parsed) {
    const validation = validateClassifierOutput(parsed)
    if (!validation.valid) {
      logger.warn('Intent classifier: invalid LLM output — retrying once', {
        requestId: metadata?.requestId,
        reason: validation.reason,
      })
      // One retry
      parsed = await callLlmClassifier(message, farmerContext, metadata)
      if (parsed) {
        const retry = validateClassifierOutput(parsed)
        if (!retry.valid) {
          logger.warn('Intent classifier: retry also invalid — using fallback', {
            requestId: metadata?.requestId,
            reason: retry.reason,
          })
          parsed = null
        }
      }
    }
  }

  let result
  if (parsed) {
    result = normalizeClassifierOutput(parsed)
    result = applyPostClassificationSafety(result, message)
  } else {
    logger.warn('Intent classifier: using safe fallback classification', {
      requestId: metadata?.requestId,
    })
    result = buildFallbackClassification(message)
  }

  logger.info('Intent classified', {
    requestId: metadata?.requestId,
    intent: result.primaryIntent,
    confidence: result.confidenceCategory,
    requiresLiveData: result.requiresLiveData,
    durationMs: Date.now() - start,
  })

  return result
}
