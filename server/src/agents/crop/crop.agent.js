/**
 * Crop Recommendation Agent — Phase 13 (rev 2).
 *
 * Changes from rev 1:
 *
 *   Fix 1 — isDemo propagation.
 *     CropProfile.isDemo means "curated static agronomic data" (i.e. not a live
 *     database record), NOT "demo / mock mode".  The top-level result.isDemo
 *     now reflects ONLY whether the underlying live providers (weather, market,
 *     AI) are running in mock mode — it is never forced true by crop-profile
 *     metadata.  The recommendation.isDemo field still records whether the
 *     agronomic profiles are curated data so the frontend can show the
 *     "ICAR/ICRISAT guidelines" disclaimer without polluting the live/demo flag.
 *
 *   Fix 2 + Fix 8 — Canonical location resolution.
 *     Message-explicit location always wins over session memory and FarmerProfile.
 *     A new resolveCanonicalLocation() helper extracts the operative location
 *     from the message (via the existing LocationResolver), falls back to
 *     FarmerProfile, and injects it into farmerContext before any evidence
 *     collection.  This prevents the weather and market adapters from silently
 *     using a stale profile location (e.g. "Nashik") when the user asked about
 *     a different place ("Karnal").
 *
 *   Fix 3 — Market data is collected and surfaced.
 *     collectAllEvidence already calls MarketProvider per-crop (correct).
 *     The prompt now explicitly includes a market summary section and
 *     agentsUsed now lists "MarketProvider" so the front-end and logs
 *     show that market data influenced the recommendation.
 *
 *   Fix 4 — Single integrated answer.
 *     The LLM is given a richer prompt that asks for ONE integrated response
 *     covering crop recommendation + weather impact + market trend, instead of
 *     separate sections.  The orchestrator no longer needs to merge a separate
 *     WeatherAgent answer.  When the classifier routes CROP_RECOMMENDATION
 *     directly (which it now does for crop-primary queries), the agent handles
 *     everything in one call.
 *
 *   Fix 6 — Explainability.
 *     The agent now populates the explainability object on the result with
 *     weather contribution, market contribution, score breakdown, memory
 *     contribution, and final confidence.
 *
 *   Fix 7 — Scheme evidence is conditional.
 *     collectSchemeEvidence is only called when the user message contains
 *     scheme/subsidy keywords.  For pure crop-selection queries the scheme
 *     adapter is skipped, reducing latency and unnecessary DB queries.
 *
 * Flow:
 *   1. Resolve canonical location (message > profile)
 *   2. Validate farmer context — check for critical missing fields
 *   3. Resolve season from message or farmer profile
 *   4. Generate candidate crop list from verified CropProfile data
 *   5. Collect evidence in parallel:
 *        a. Weather data (WeatherProvider via cache)
 *        b. Market data per crop (MarketProvider via cache)
 *        c. RAG knowledge per crop (rag.service.js)
 *        d. Government schemes (only if message mentions subsidies)
 *   6. Run deterministic scoring engine (CropScoringService)
 *   7. Apply hard disqualification rules
 *   8. Rank surviving candidates
 *   9. Call watsonx.ai model to produce ONE integrated explanation
 *  10. Return normalized AgentResult with recommendation + explainability
 *
 * Safety rules:
 *   - NEVER ask the LLM which crop to grow — scores are computed, not generated.
 *   - NEVER invent crop suitability, weather values, or market prices.
 *   - NEVER call the LLM if scoring fails — return partial_success with data.
 *   - If critical context is missing → return NEEDS_CLARIFICATION.
 *   - All recommendation data attached to result.recommendation for frontend.
 *   - result.isDemo reflects live provider mock status ONLY.
 */
import { getAiProvider } from '../../providers/ai.provider.factory.js'
import { findProfilesBySeason, getAllCropProfiles } from '../../data/seed/cropProfiles.seed.js'
import { collectAllEvidence } from '../../services/cropEvidence.service.js'
import { rankCandidates } from '../../services/cropScoring.service.js'
import { resolveWeatherLocation } from '../../services/locationResolver.service.js'
import {
  buildCropAgentSystemPrompt,
  buildCropAgentUserMessage,
  buildClarificationMessage,
} from './crop.prompt.js'
import { createAgentResult, normalizeAgentResult } from '../agentResult.js'
import { INTENT, RESULT_STATUS } from '../intents.js'
import config from '../../config/env.js'
import logger from '../../utils/logger.js'

// ── Season resolution ─────────────────────────────────────────────────────────

const KHARIF_PATTERNS = [
  /\bkharif\b/i,
  /\b(june|july|august|september|october)\b/i,
  /\b(monsoon|rainy season)\b/i,
  /\bjun|jul|aug|sep|oct\b/i,
]

const RABI_PATTERNS = [
  /\brabi\b/i,
  /\b(november|december|january|february|march)\b/i,
  /\bwinter (season|crop)\b/i,
  /\bnov|dec|jan|feb|mar\b/i,
]

const ZAID_PATTERNS = [
  /\bzaid\b/i,
  /\bsummer (season|crop)\b/i,
  /\b(april|may)\b/i,
]

/**
 * Resolve the intended growing season from message and context.
 *
 * @param {string} message
 * @param {object} farmerContext
 * @returns {string|null}
 */
function resolveSeason(message, farmerContext) {
  const msg = message ?? ''
  if (KHARIF_PATTERNS.some((p) => p.test(msg))) return 'Kharif'
  if (RABI_PATTERNS.some((p) => p.test(msg))) return 'Rabi'
  if (ZAID_PATTERNS.some((p) => p.test(msg))) return 'Zaid'

  const ctxSeason = farmerContext?.cropContext?.season ?? farmerContext?.season
  if (ctxSeason) {
    if (/kharif/i.test(ctxSeason)) return 'Kharif'
    if (/rabi/i.test(ctxSeason)) return 'Rabi'
    if (/zaid/i.test(ctxSeason)) return 'Zaid'
  }

  // Auto-detect from current month when no explicit season
  const month = new Date().getMonth() + 1 // 1-12
  if (month >= 6 && month <= 10) return 'Kharif'
  if (month >= 11 || month <= 3) return 'Rabi'
  return 'Zaid'
}

// ── Canonical location resolution ─────────────────────────────────────────────

/**
 * Keywords that indicate the user wants scheme/subsidy info.
 * Used to conditionally skip the scheme evidence adapter.
 */
const SCHEME_KEYWORDS = [
  /\b(scheme|subsidy|subsidies|government|pm-kisan|pmfby|insurance|credit|loan|kcc|nabard)\b/i,
  /\b(yojana|sarkar|anudaan|bima|sarkari)\b/i,
]

/**
 * Resolve the canonical location for crop evidence collection.
 *
 * Priority:
 *   1. Location explicitly mentioned in the current message
 *   2. FarmerProfile location (district / state)
 *
 * This ensures that "which crop for Karnal" uses Karnal even when the
 * FarmerProfile was created in Nashik.  Memory is NEVER allowed to override
 * an explicit user location.
 *
 * @param {string} message
 * @param {object} farmerContext
 * @param {object} metadata
 * @returns {{ district: string|null, state: string|null, locationName: string|null, source: string }}
 */
function resolveCanonicalLocation(message, farmerContext, metadata) {
  // Try to extract explicit location from the message
  const fromMessage = resolveWeatherLocation({ message, farmerContext: {}, metadata })

  if (fromMessage && (fromMessage.district || fromMessage.state)) {
    logger.info('CropAgent: using message-explicit location', {
      requestId: metadata.requestId,
      district: fromMessage.district,
      state: fromMessage.state,
    })
    return {
      district: fromMessage.district ?? null,
      state: fromMessage.state ?? null,
      locationName: fromMessage.locationName,
      source: 'message',
    }
  }

  // Fall back to FarmerProfile location
  const profileDistrict = farmerContext?.location?.district ?? null
  const profileState = farmerContext?.location?.state ?? null

  if (profileDistrict || profileState) {
    const locationName = profileDistrict
      ? profileState ? `${profileDistrict}, ${profileState}` : profileDistrict
      : profileState

    logger.info('CropAgent: using FarmerProfile location', {
      requestId: metadata.requestId,
      district: profileDistrict,
      state: profileState,
    })
    return {
      district: profileDistrict,
      state: profileState,
      locationName,
      source: 'profile',
    }
  }

  return { district: null, state: null, locationName: null, source: 'none' }
}

// ── Critical context validation ───────────────────────────────────────────────

/**
 * Identify critical missing fields needed for a meaningful recommendation.
 *
 * @param {object} farmerContext
 * @param {string|null} season
 * @param {{ district, state }} canonicalLocation
 * @returns {string[]}
 */
function findMissingCriticalFields(farmerContext, season, canonicalLocation) {
  const missing = []

  if (!canonicalLocation.district && !canonicalLocation.state) {
    missing.push('location.state')
  }
  if (!farmerContext?.farm?.soilType) {
    missing.push('farm.soilType')
  }
  if (!farmerContext?.farm?.waterAvailability && !farmerContext?.farm?.irrigationType) {
    missing.push('farm.waterAvailability')
  }
  // Season is auto-detected from month, so only ask if completely unknown
  // (resolveSeason now always returns a value via month fallback)

  return missing
}

// ── Sources builder ───────────────────────────────────────────────────────────

/**
 * Build source cards for the agent result from collected evidence.
 *
 * @param {object[]} rankedCrops
 * @param {object} weatherEvidence
 * @param {object} knowledgeEvidenceMap
 * @param {object} marketEvidenceMap
 * @returns {object[]}
 */
function buildRecommendationSources(rankedCrops, weatherEvidence, knowledgeEvidenceMap, marketEvidenceMap) {
  const sources = []
  const seen = new Set()

  // Crop profile sources (ICAR/ICRISAT)
  for (const crop of rankedCrops) {
    for (const src of crop.officialSources ?? []) {
      if (!seen.has(src.title)) {
        seen.add(src.title)
        sources.push({
          sourceType: 'crop_profile',
          title: src.title,
          url: src.url ?? null,
          year: src.year ?? null,
        })
      }
    }
  }

  // Weather source
  if (weatherEvidence?.available) {
    sources.push({
      sourceType: 'weather_api',
      provider: weatherEvidence.provider,
      location: weatherEvidence.locationName ?? null,
      isDemo: weatherEvidence.isDemo === true,
    })
  }

  // Market source (first crop that has market data)
  for (const crop of rankedCrops) {
    const me = marketEvidenceMap?.[crop.cropCode]
    if (me?.available && me.statistics) {
      sources.push({
        sourceType: 'market_api',
        provider: 'agmarknet-datagov',
        commodity: crop.name,
        isDemo: me.isDemo === true,
      })
      break // one market source entry is enough
    }
  }

  // RAG knowledge sources
  for (const crop of rankedCrops) {
    const ke = knowledgeEvidenceMap?.[crop.cropCode]
    if (ke?.available && ke.sources?.length > 0) {
      for (const src of ke.sources.slice(0, 2)) {
        if (src.title && !seen.has(src.title)) {
          seen.add(src.title)
          sources.push({
            sourceType: 'knowledge_base',
            title: src.title,
            organization: src.organization ?? null,
          })
        }
      }
    }
  }

  return sources
}

// ── Explainability builder ────────────────────────────────────────────────────

/**
 * Build the explainability object for the agent result.
 * Covers: weather contribution, market contribution, score breakdown,
 * memory contribution, LLM contribution, final confidence.
 *
 * @param {object} params
 * @returns {object}
 */
function buildExplainability({
  topCrops,
  weatherEvidence,
  marketEvidenceMap,
  schemeEvidence,
  memoryContext,
  aiResult,
  season,
  canonicalLocation,
}) {
  const top = topCrops[0]
  if (!top) return {}

  const scoreBreakdown = Object.entries(top.factorBreakdown ?? {})
    .filter(([, f]) => f.available)
    .map(([key, f]) => `${key}: ${f.score}/100`)

  const weatherContrib = weatherEvidence?.available
    ? `Weather data for ${canonicalLocation.locationName ?? 'location'}: ` +
      `${weatherEvidence.current?.condition ?? 'N/A'} at ${weatherEvidence.current?.temperatureC ?? 'N/A'}°C. ` +
      `weatherFit score: ${top.factorBreakdown?.weatherFit?.score ?? 'N/A'}/100`
    : 'Weather data unavailable — weatherFit not scored'

  const marketContrib = (() => {
    const me = marketEvidenceMap?.[top.cropCode]
    if (!me?.available || !me.statistics) return 'Market data unavailable — marketEvidence not scored'
    return (
      `${top.name} market: modal price ₹${me.statistics.modalPrice ?? 'N/A'}/quintal, ` +
      `trend: ${me.trend?.trendStatus ?? 'unknown'}. ` +
      `marketEvidence score: ${top.factorBreakdown?.marketEvidence?.score ?? 'N/A'}/100`
    )
  })()

  const memContrib = memoryContext
    ? 'Historical farmer memory used for context (crop preferences, previous recommendations)'
    : 'No historical memory used'

  return {
    explanation: `${top.name} ranked #1 with a score of ${top.score}/100 (${top.suitabilityLabel}) based on deterministic scoring across ${scoreBreakdown.length} evidence factors.`,
    supportingEvidence: scoreBreakdown,
    sourceAgent: 'CropAgent',
    confidenceReason: `Evidence coverage: ${top.evidenceCoverage}% across all scoring factors.`,
    weatherContribution: weatherContrib,
    marketContribution: marketContrib,
    memoryContribution: memContrib,
    llmContribution: aiResult
      ? `${aiResult.isDemo ? 'Mock AI' : `IBM watsonx.ai (${config.watsonx.modelId})`} generated the farmer-friendly explanation.`
      : 'LLM explanation unavailable — raw scores returned.',
    cropScoreBreakdown: scoreBreakdown,
    finalConfidence: top.confidence,
    season,
    candidatesEvaluated: topCrops.length,
  }
}

// ── Main agent function ───────────────────────────────────────────────────────

/**
 * Run the Crop Recommendation Agent.
 *
 * @param {object} params
 * @param {string} params.message - Farmer's crop question
 * @param {object} [params.farmerContext={}] - Normalized FarmerProfile context
 * @param {string[]} [params.classifierMissingInfo=[]] - Missing info from classifier
 * @param {object|null} [params.memoryContext=null] - Memory context string
 * @param {string} [params.language='en'] - Response language
 * @param {object} [params.metadata={}] - Request metadata for logging
 * @returns {Promise<object>} Normalized agent result
 */
export async function runCropAgent({
  message,
  farmerContext = {},
  classifierMissingInfo = [],
  memoryContext = null,
  language = 'en',
  metadata = {},
}) {
  const start = Date.now()
  logger.info('CropAgent: starting', { requestId: metadata.requestId })

  // ── Step 1: Resolve canonical location ───────────────────────────────
  // Message-explicit location ALWAYS overrides FarmerProfile location.
  // This prevents stale profile location (e.g. Nashik) from being used
  // when the user explicitly asks about a different place (e.g. Karnal).
  const canonicalLocation = resolveCanonicalLocation(message, farmerContext, metadata)

  // Build an augmented farmerContext with the canonical location injected
  // so all downstream services (evidence, scoring, prompt) use it uniformly.
  const effectiveFarmerContext = {
    ...farmerContext,
    location: {
      ...farmerContext.location,
      district: canonicalLocation.district ?? farmerContext.location?.district ?? null,
      state: canonicalLocation.state ?? farmerContext.location?.state ?? null,
    },
  }

  // ── Step 2: Resolve season ────────────────────────────────────────────
  const season = resolveSeason(message, effectiveFarmerContext)

  // ── Step 3: Check for missing critical context ────────────────────────
  const missingFromContext = findMissingCriticalFields(effectiveFarmerContext, season, canonicalLocation)
  const allMissing = [...new Set([...classifierMissingInfo, ...missingFromContext])]

  if (allMissing.length > 0) {
    logger.info('CropAgent: missing critical context — requesting clarification', {
      requestId: metadata.requestId,
      missingFields: allMissing,
    })
    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.CLARIFICATION,
        status: RESULT_STATUS.NEEDS_CLARIFICATION,
        answer: buildClarificationMessage(allMissing),
        agentsUsed: ['CropAgent'],
        sources: [],
        grounded: false,
        missingInformation: allMissing,
        warnings: [],
        // isDemo reflects mock provider state only — never crop-profile metadata
        isDemo: config.providers.useMocks,
      })
    )
  }

  // ── Step 4: Generate candidate crops ─────────────────────────────────
  const candidateLimit = config.crop.candidateLimit
  let candidates = findProfilesBySeason(season)
  if (candidates.length === 0) candidates = getAllCropProfiles()
  candidates = candidates.slice(0, candidateLimit)

  logger.debug('CropAgent: candidate crops generated', {
    requestId: metadata.requestId,
    count: candidates.length,
    season,
    location: canonicalLocation.locationName,
  })

  // ── Step 5: Decide whether to fetch scheme evidence ───────────────────
  // Only call SchemeService when the farmer's message explicitly mentions
  // subsidies, government schemes, or insurance.  This avoids unnecessary
  // DB queries for pure crop-selection questions.
  const needsSchemeData = SCHEME_KEYWORDS.some((p) => p.test(message ?? ''))

  // ── Step 6: Collect evidence in parallel ─────────────────────────────
  const { weatherEvidence, marketEvidenceMap, knowledgeEvidenceMap, schemeEvidence, collectionWarnings } =
    await collectAllEvidence({
      candidates,
      farmerContext: { ...effectiveFarmerContext, season },
      season,
      metadata,
      collectSchemes: needsSchemeData,
    })

  logger.info('CropAgent: evidence collected', {
    requestId: metadata.requestId,
    weatherAvailable: weatherEvidence?.available,
    marketCropsWithData: Object.values(marketEvidenceMap).filter((m) => m.available && m.statistics).length,
    schemesAvailable: schemeEvidence?.available,
    needsSchemeData,
  })

  // ── Step 7: Score and rank candidates ────────────────────────────────
  const rankedAll = rankCandidates({
    candidates,
    farmerContext: { ...effectiveFarmerContext, season },
    weatherEvidence,
    marketEvidenceMap,
    knowledgeEvidenceMap,
    schemeEvidence,
    weights: config.crop.weights,
  })

  if (rankedAll.length === 0) {
    logger.warn('CropAgent: all candidates disqualified', { requestId: metadata.requestId })
    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.CROP_RECOMMENDATION,
        status: RESULT_STATUS.NEEDS_CLARIFICATION,
        answer:
          'Based on your current farm profile, none of the candidate crops fully matched your conditions. ' +
          'This may be due to a season mismatch or severe water incompatibility. ' +
          'Please verify your soil type, water availability, and target season, or consult your local Krishi Vigyan Kendra (KVK).',
        agentsUsed: ['CropAgent', 'CropScoringService'],
        sources: [],
        grounded: false,
        warnings: ['All candidate crops were disqualified by hard constraints', ...collectionWarnings],
        isDemo: config.providers.useMocks,
      })
    )
  }

  const resultLimit = config.crop.resultLimit
  const topCrops = rankedAll.slice(0, resultLimit)

  logger.info('CropAgent: scoring complete', {
    requestId: metadata.requestId,
    topCrop: topCrops[0]?.name,
    topScore: topCrops[0]?.score,
    rankedCount: rankedAll.length,
  })

  // ── Step 8: Call LLM to produce ONE integrated explanation ────────────
  // The LLM is given weather + market context and asked to produce a single
  // coherent answer — not split sections. This replaces the previous pattern
  // where a separate WeatherAgent call was merged via the orchestrator.
  let aiResult
  const agentsUsed = ['CropAgent', 'CropScoringService']
  let answer = ''
  let status = RESULT_STATUS.SUCCESS

  // Determine which live providers ran (for agentsUsed transparency)
  if (weatherEvidence?.available) {
    agentsUsed.push(`WeatherProvider (${weatherEvidence.provider})`)
  }
  const marketCropsWithData = Object.values(marketEvidenceMap).filter((m) => m.available && m.statistics)
  if (marketCropsWithData.length > 0) {
    agentsUsed.push('MarketProvider (agmarknet-datagov)')
  }
  if (needsSchemeData && schemeEvidence?.available) {
    agentsUsed.push('SchemeService')
  }

  try {
    const aiProvider = getAiProvider()
    const systemPrompt = buildCropAgentSystemPrompt(language)
    const userMessage = buildCropAgentUserMessage({
      originalMessage: message,
      farmerContext: effectiveFarmerContext,
      season,
      rankedCrops: topCrops,
      weatherEvidence,
      marketEvidenceMap,
      schemeEvidence,
      memoryContext,
      canonicalLocation,
    })

    aiResult = await aiProvider.generate({
      messages: [{ role: 'user', content: userMessage }],
      systemPrompt,
      parameters: {
        max_tokens: 900,
        temperature: 0.2,
        top_p: 0.9,
      },
      metadata,
    })

    answer = aiResult.content
    agentsUsed.push(aiResult.isDemo ? 'Mock AI' : `IBM Granite (${config.watsonx.modelId})`)
  } catch (err) {
    logger.error('CropAgent: LLM explanation failed', {
      requestId: metadata.requestId,
      code: err.code ?? 'UNKNOWN',
    })
    status = RESULT_STATUS.PARTIAL_SUCCESS
    answer =
      `**Crop Recommendation Results** (AI explanation unavailable)\n\n` +
      topCrops
        .map(
          (c) =>
            `**#${c.rank} ${c.name}** — Score: ${c.score}/100 (${c.suitabilityLabel})\n` +
            `Evidence coverage: ${c.evidenceCoverage}% | Confidence: ${c.confidence}\n` +
            `Key risks: ${c.keyRisks.slice(0, 2).join('; ')}`
        )
        .join('\n\n')
  }

  // ── Step 9: Build warnings ────────────────────────────────────────────
  const warnings = [...collectionWarnings]
  if (topCrops[0]?.confidence === 'low') {
    warnings.push(
      'Recommendation confidence is low due to limited evidence. ' +
        'Please provide soil type, water availability, and season for a more precise recommendation.'
    )
  }
  if (!weatherEvidence?.available) {
    warnings.push('Weather data was unavailable — weather suitability not included in scoring.')
  }
  if (marketCropsWithData.length === 0) {
    warnings.push('Market price data was unavailable — market demand not included in scoring.')
  }
  if (canonicalLocation.source === 'none') {
    warnings.push('Location could not be determined — scoring based on general agronomic data only.')
  }

  // ── Step 10: Build recommendation data for frontend ───────────────────
  //
  // IMPORTANT: result.isDemo = live-provider mock status ONLY.
  //   - config.providers.useMocks = true  → all providers are mocked  → isDemo:true
  //   - config.providers.useMocks = false → real providers used       → isDemo:false
  //
  // crop.isDemo (from CropProfile) = "this profile is curated static data from
  //   ICAR/ICRISAT, not a live database row".  This is always true for our seed
  //   data and has NOTHING to do with demo/production mode.  It is stored in
  //   recommendationData.isCuratedData for the frontend disclaimer, but must
  //   NEVER be OR'd into the top-level isDemo flag.
  const isLiveProviderDemo = config.providers.useMocks ||
    (weatherEvidence?.available && weatherEvidence.isDemo === true && !config.providers.useMocks
      ? false  // real weather provider ran → not demo
      : config.providers.useMocks)

  // Simplified: isDemo = whether we're running in mock mode
  const resultIsDemo = config.providers.useMocks

  const recommendationData = {
    season: season ?? 'Not specified',
    location: canonicalLocation.locationName ?? null,
    locationSource: canonicalLocation.source,
    scoringVersion: config.crop.scoringVersion,
    candidatesEvaluated: rankedAll.length,
    topCrops: topCrops.map((c) => ({
      rank: c.rank,
      cropCode: c.cropCode,
      name: c.name,
      score: c.score,
      suitabilityLabel: c.suitabilityLabel,
      suitabilityColor: c.suitabilityColor,
      evidenceCoverage: c.evidenceCoverage,
      confidence: c.confidence,
      waterRequirementCategory: c.waterRequirementCategory,
      durationDays: c.durationDays,
      riskLevel: c.riskLevel,
      keyRisks: c.keyRisks,
      factorBreakdown: c.factorBreakdown,
    })),
    evidenceSummary: {
      weatherAvailable: weatherEvidence?.available === true,
      marketAvailable: marketCropsWithData.length > 0,
      knowledgeAvailable: Object.values(knowledgeEvidenceMap).some((k) => k.available),
      schemeAvailable: schemeEvidence?.available === true,
    },
    // isCuratedData: the agronomic profiles come from static ICAR/ICRISAT data.
    // This is separate from isDemo (mock provider mode) and is always true for
    // the seed data. The frontend can use this for the "data sourced from ICAR"
    // disclaimer without confusing it with mock/demo mode.
    isCuratedData: true,
    isDemo: resultIsDemo,
  }

  const durationMs = Date.now() - start
  logger.info('CropAgent: complete', {
    requestId: metadata.requestId,
    topCrop: topCrops[0]?.name,
    topScore: topCrops[0]?.score,
    season,
    location: canonicalLocation.locationName,
    isDemo: resultIsDemo,
    durationMs,
  })

  // ── Step 11: Build explainability ─────────────────────────────────────
  const explainability = buildExplainability({
    topCrops,
    weatherEvidence,
    marketEvidenceMap,
    schemeEvidence,
    memoryContext,
    aiResult,
    season,
    canonicalLocation,
  })

  return normalizeAgentResult(
    createAgentResult({
      intent: INTENT.CROP_RECOMMENDATION,
      status,
      answer,
      agentsUsed,
      sources: buildRecommendationSources(topCrops, weatherEvidence, knowledgeEvidenceMap, marketEvidenceMap),
      grounded: true,
      missingInformation: [],
      warnings,
      provider: aiResult?.provider ?? null,
      model: aiResult?.model ?? null,
      // isDemo = mock provider status only, never crop-profile metadata
      isDemo: resultIsDemo,
      recommendation: recommendationData,
      explainability,
    })
  )
}
