/**
 * Scheme Agent — Phase 12.
 *
 * Replaces the Phase 9 placeholder with a full, verified-data-backed implementation.
 *
 * Flow:
 *   1. Receive farmer message + FarmerProfile context
 *   2. Detect scheme query type (deterministic patterns)
 *   3. Resolve named scheme from message (if any)
 *   4. Find candidate schemes from repository (category/state filtered)
 *   5. Evaluate eligibility deterministically (NO LLM involvement)
 *   6. Retrieve supporting RAG context from indexed scheme documents
 *   7. Build structured data package for LLM
 *   8. Call watsonx.ai (model from config.watsonx.modelId) to explain the result
 *   9. Return normalized Agent Result with official source metadata
 *
 * Safety rules:
 *   - NEVER let the LLM decide eligibility — the evaluator does that.
 *   - NEVER invent scheme names, benefits, documents, URLs, or deadlines.
 *   - NEVER claim guaranteed eligibility or approval.
 *   - NEVER call the LLM if scheme data retrieval completely fails.
 *   - All scheme facts in the answer come from repository records.
 *   - Every response with scheme claims includes official source metadata.
 *   - isDemo: true flags propagate through to the agent result.
 *
 * The Agent Router selects this agent for SCHEME intent.
 * Controllers must not call this agent directly.
 */
import { getAiProvider } from '../../providers/ai.provider.factory.js'
import {
  findCandidates,
  evaluateSchemes,
  retrieveSchemeContext,
  buildSchemeSourceCard,
  findSchemeByCode,
} from '../../services/schemes.service.js'
import { runSchemeSeed } from '../../data/seed/schemes.seed.js'
import { buildSchemeAgentSystemPrompt, buildSchemeAgentUserMessage } from './scheme.prompt.js'
import { createAgentResult, normalizeAgentResult } from '../agentResult.js'
import { INTENT, RESULT_STATUS } from '../intents.js'
import { ELIGIBILITY_STATUS } from '../../services/schemeEligibility.service.js'
import config from '../../config/env.js'
import logger from '../../utils/logger.js'

// ── Query type detection ──────────────────────────────────────────────────────

/**
 * Supported scheme query types with detection patterns.
 */
const QUERY_TYPES = {
  ELIGIBILITY_CHECK: {
    label: 'ELIGIBILITY_CHECK',
    patterns: [
      /\b(am i|are we|is my|do i|can i)\b.*(eligible|qualify|entitled|applicable)\b/i,
      /\b(eligib|qualify|qualification|qualify for|entitled to)\b/i,
      /\b(main|kya main).*(eligible|laabh uthaa)\b/i,
    ],
  },
  SCHEME_DISCOVERY: {
    label: 'SCHEME_DISCOVERY',
    patterns: [
      /\b(which|what|list|any|available|show)\b.*(scheme|subsidy|yojana|benefit|programme)\b/i,
      /\b(government help|sarkari madad|sarkar.* scheme)\b/i,
      /\b(schemes? (for|related|about|available))\b/i,
    ],
  },
  DOCUMENTS_REQUIRED: {
    label: 'DOCUMENTS_REQUIRED',
    patterns: [
      /\b(document|papers|form|proof|certificate|what.*need|kya.*chahiye)\b.*(apply|register|enroll|scheme)\b/i,
      /\b(how to apply|kaise apply|application process)\b/i,
      /\b(required documents?|documents? required)\b/i,
    ],
  },
  NAMED_SCHEME_QUERY: {
    label: 'NAMED_SCHEME_QUERY',
    patterns: [
      /\b(pm.?kisan|pm\s*kisan)\b/i,
      /\b(pmfby|fasal bima)\b/i,
      /\b(pmksy|krishi sinchayee|micro.?irrigation|drip.*subsidy|sprinkler.*subsidy)\b/i,
      /\b(kisan credit card|kcc)\b/i,
      /\b(soil health card|shc|mitti.*test)\b/i,
      /\b(aif|agriculture infrastructure fund)\b/i,
    ],
  },
  BENEFITS_QUERY: {
    label: 'BENEFITS_QUERY',
    patterns: [
      /\b(how much|kitna|benefit|amount|money|subsidy amount|payment|installment)\b/i,
      /\b(what.*benefit|benefit.*receive|money.*get|paise.*milenge)\b/i,
    ],
  },
  APPLICATION_STEPS: {
    label: 'APPLICATION_STEPS',
    patterns: [
      /\b(how.*apply|apply.*kaise|application.*step|register|enroll|sign up)\b/i,
      /\b(kaise.*kare|kaise.*apply|steps? to apply)\b/i,
    ],
  },
}

/**
 * Detect the scheme query type from the message.
 *
 * @param {string} message
 * @returns {string} Query type label
 */
export function detectSchemeQueryType(message) {
  for (const [, typeDef] of Object.entries(QUERY_TYPES)) {
    for (const pattern of typeDef.patterns) {
      if (pattern.test(message)) {
        return typeDef.label
      }
    }
  }
  return 'SCHEME_DISCOVERY' // default
}

// ── Named scheme extractor ────────────────────────────────────────────────────

/**
 * Attempt to extract a specific scheme code from the message.
 * Returns null if no known scheme is mentioned.
 *
 * @param {string} message
 * @returns {string|null} schemeCode or null
 */
function extractNamedSchemeCode(message) {
  const lower = message.toLowerCase()
  if (/pm[\s-]?kisan/i.test(message)) return 'PM-KISAN'
  if (/pmfby|fasal bima/i.test(message)) return 'PMFBY'
  if (/pmksy|krishi sinchayee|per drop|micro.?irrigation/i.test(message)) return 'PMKSY-PDMC'
  if (/kisan credit card|\bkcc\b/i.test(message)) return 'KCC'
  if (/soil health card|\bshc\b|mitti.*test/i.test(message)) return 'SHC'
  if (/agriculture infrastructure fund|\baif\b/i.test(message)) return 'AIF'
  // eslint-disable-next-line no-unused-vars
  void lower
  return null
}

// ── Category hint extractor ───────────────────────────────────────────────────

/**
 * Extract category hints from the message to narrow scheme discovery.
 *
 * @param {string} message
 * @returns {string[]} Array of category hint strings
 */
function extractCategoryHints(message) {
  const categories = []
  if (/\b(irrigation|sinchayee|drip|sprinkler|water)\b/i.test(message)) {
    categories.push('irrigation')
  }
  if (/\b(insurance|bima|crop.?loss|fasal)\b/i.test(message)) {
    categories.push('crop insurance')
  }
  if (/\b(credit|loan|kcc|bank)\b/i.test(message)) {
    categories.push('credit')
  }
  if (/\b(income|kisan|support|cash)\b/i.test(message)) {
    categories.push('income support')
  }
  if (/\b(soil|health card|mitti)\b/i.test(message)) {
    categories.push('soil health')
  }
  if (/\b(infrastructure|warehouse|cold storage|aif)\b/i.test(message)) {
    categories.push('infrastructure')
  }
  return categories
}

// ── Language resolver ─────────────────────────────────────────────────────────

/**
 * Resolve the preferred response language from farmer context.
 *
 * @param {object} farmerContext
 * @returns {string}
 */
function resolveLanguage(farmerContext) {
  return farmerContext?.preferences?.language ?? 'en'
}

// ── Seed guard ────────────────────────────────────────────────────────────────

let _seedAttempted = false

/**
 * Ensure the in-memory / MongoDB store has at least some scheme records.
 * On first call, runs the seed if needed. Subsequent calls are no-ops.
 */
async function ensureSeedData() {
  if (_seedAttempted) return
  _seedAttempted = true
  try {
    await runSchemeSeed()
  } catch (err) {
    logger.warn('SchemeAgent: seed guard failed (non-fatal)', { error: err.message })
  }
}

// ── Main agent ────────────────────────────────────────────────────────────────

/**
 * Run the Scheme Agent — Phase 12.
 *
 * @param {object} params
 * @param {string} params.message - Farmer's scheme question
 * @param {object} [params.farmerContext={}] - Normalized FarmerProfile context
 * @param {object} [params.metadata={}] - Request metadata for logging
 * @returns {Promise<object>} Normalized agent result
 */
export async function runSchemeAgent({ message, farmerContext = {}, memoryContext = null, metadata = {} }) {
  const requestId = metadata.requestId ?? 'unknown'
  const language = resolveLanguage(farmerContext)

  logger.info('SchemeAgent: start', { requestId, message: message?.slice(0, 80) })

  // ── Ensure seed data is available ──────────────────────────────────────────
  await ensureSeedData()

  // ── Detect query type ───────────────────────────────────────────────────────
  const queryType = detectSchemeQueryType(message)
  logger.debug('SchemeAgent: query type', { requestId, queryType })

  // ── Named scheme extraction ─────────────────────────────────────────────────
  const namedSchemeCode = extractNamedSchemeCode(message)
  const categoryHints = extractCategoryHints(message)

  // ── Scheme resolution ───────────────────────────────────────────────────────
  let candidates = []
  let schemeWarnings = []

  if (namedSchemeCode) {
    // Single named scheme lookup
    const namedScheme = await findSchemeByCode(namedSchemeCode)
    if (namedScheme) {
      candidates = [namedScheme]
    } else {
      // Named scheme not in repository — fall through to general discovery
      logger.info('SchemeAgent: named scheme not found, falling back to discovery', {
        requestId,
        namedSchemeCode,
      })
      schemeWarnings.push(
        `The scheme "${namedSchemeCode}" was not found in the current knowledge base. ` +
          'Showing related schemes from the available catalogue.'
      )
    }
  }

  if (candidates.length === 0) {
    const discoveryResult = await findCandidates({ farmerContext, categories: categoryHints })
    candidates = discoveryResult.candidates
    schemeWarnings = [...schemeWarnings, ...discoveryResult.warnings]
  }

  // ── No candidates found ─────────────────────────────────────────────────────
  if (candidates.length === 0) {
    logger.info('SchemeAgent: no candidate schemes found', { requestId })
    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.SCHEME,
        status: RESULT_STATUS.NEEDS_CLARIFICATION,
        answer:
          'I could not find matching government scheme records for your query in the current knowledge base. ' +
          'Please try asking about a specific scheme (e.g., "PM-KISAN", "PMFBY crop insurance") ' +
          'or share more details about what type of support you are looking for (irrigation, insurance, credit, etc.).\n\n' +
          'You can also contact your local Krishi Vigyan Kendra (KVK) or gram panchayat office for guidance.',
        agentsUsed: ['SchemeAgent'],
        sources: [],
        grounded: false,
        warnings: schemeWarnings,
        missingInformation: ['Specific scheme name or category of support needed'],
      })
    )
  }

  // ── Eligibility evaluation (deterministic — no LLM) ─────────────────────────
  const { evaluations, warnings: evalWarnings } = await evaluateSchemes({ farmerContext, schemes: candidates })
  schemeWarnings = [...schemeWarnings, ...evalWarnings]

  // ── RAG context retrieval (best-effort) ─────────────────────────────────────
  let ragChunks = []
  try {
    const ragResult = await retrieveSchemeContext({ question: message, language, metadata })
    ragChunks = ragResult?.results?.map((r) => ({
      chunkId: r.chunkId,
      documentId: r.documentId,
      score: r.score,
      text: r.textPreview ?? '',
      pageNumber: r.source?.pageNumber ?? null,
      title: r.source?.title ?? 'Government Scheme Document',
      organization: r.source?.organization ?? '',
      documentDate: r.source?.documentDate ?? null,
    })) ?? []
  } catch {
    // RAG failure is non-fatal
    ragChunks = []
  }

  // ── Build source cards ──────────────────────────────────────────────────────
  const schemeSources = candidates.map(buildSchemeSourceCard)
  const ragSources = ragChunks.map((chunk) => ({
    sourceType: 'rag_document',
    title: chunk.title,
    organization: chunk.organization,
    documentDate: chunk.documentDate,
    pageNumber: chunk.pageNumber,
    score: chunk.score,
  }))

  // ── LLM explanation ─────────────────────────────────────────────────────────
  const aiProvider = getAiProvider()
  const systemPrompt = buildSchemeAgentSystemPrompt(language)
  const userMessage = buildSchemeAgentUserMessage({
    question: message,
    queryType,
    evaluations,
    ragChunks,
    memoryContext,
    language,
  })

  let aiResult
  try {
    aiResult = await aiProvider.generate({
      messages: [{ role: 'user', content: userMessage }],
      systemPrompt,
      parameters: { max_tokens: 900, temperature: 0.2, top_p: 0.85 },
      metadata,
    })
  } catch (err) {
    logger.error('SchemeAgent: LLM call failed', {
      requestId,
      errorCode: err.code ?? 'UNKNOWN',
    })
    // Return partial result with raw structured data if LLM fails
    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.SCHEME,
        status: RESULT_STATUS.PARTIAL_SUCCESS,
        answer:
          `Found ${candidates.length} scheme(s) matching your query but the AI explanation is temporarily unavailable. ` +
          `Schemes found: ${candidates.map((s) => s.name).join(', ')}. ` +
          `Please visit the official portals for details: ${candidates.map((s) => s.officialSourceUrl).filter(Boolean).join(', ')}.`,
        agentsUsed: ['SchemeAgent', 'SchemeRepository', 'EligibilityEvaluator'],
        sources: schemeSources,
        grounded: candidates.length > 0,
        warnings: [
          ...schemeWarnings,
          'AI explanation is temporarily unavailable. Please use the official scheme portals.',
        ],
        scheme: buildSchemeResultData(evaluations),
        isDemo: candidates.some((s) => s.isDemo),
      })
    )
  }

  // ── Compose result ──────────────────────────────────────────────────────────
  const isDemo = candidates.some((s) => s.isDemo) || aiResult.isDemo

  // Standard disclaimer — always added to scheme responses
  const disclaimer =
    '\n\n⚠️ Final eligibility is determined by the responsible government authority. ' +
    'Verify current scheme status and deadlines at the official portal before applying.'

  const answer = aiResult.content + (aiResult.content.includes('official portal') ? '' : disclaimer)

  // Compose warnings
  const allWarnings = [
    ...schemeWarnings,
    ...evaluations
      .filter((e) => e.stale)
      .map((e) => e.staleWarning)
      .filter(Boolean),
  ]

  // isDemo warning
  if (isDemo) {
    allWarnings.push(
      'Scheme data is based on curated records and may not reflect the most recent government updates.'
    )
  }

  logger.info('SchemeAgent: complete', {
    requestId,
    schemesFound: candidates.length,
    queryType,
    model: aiResult.model,
    isDemo,
  })

  return normalizeAgentResult(
    createAgentResult({
      intent: INTENT.SCHEME,
      status: RESULT_STATUS.SUCCESS,
      answer,
      agentsUsed: [
        'SchemeAgent',
        'SchemeRepository',
        'EligibilityEvaluator',
        ...(ragChunks.length > 0 ? ['RAGRetrieval'] : []),
        `watsonx/${aiResult.model ?? config.watsonx.modelId}`,
      ],
      sources: [...schemeSources, ...ragSources],
      grounded: candidates.length > 0 || ragChunks.length > 0,
      warnings: allWarnings,
      missingInformation: extractMissingInfo(evaluations),
      provider: aiResult.provider,
      model: aiResult.model,
      retrieval: ragChunks.length > 0
        ? { chunksRetrieved: ragChunks.length, documentsUsed: ragSources.length }
        : null,
      isDemo,
      // Structured scheme data for the frontend SchemeDataPanel
      scheme: buildSchemeResultData(evaluations),
    })
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract missing information from eligibility evaluations.
 *
 * @param {object[]} evaluations
 * @returns {string[]}
 */
function extractMissingInfo(evaluations) {
  const missing = new Set()
  for (const { evaluation } of evaluations) {
    if (evaluation.status === ELIGIBILITY_STATUS.MORE_INFORMATION_REQUIRED) {
      for (const field of evaluation.missingInformation ?? []) {
        missing.add(field)
      }
    }
  }
  return Array.from(missing)
}

/**
 * Build the structured scheme data object for the frontend.
 * Mirrors the `market` field pattern in market.agent.js.
 *
 * @param {object[]} evaluations
 * @returns {object}
 */
function buildSchemeResultData(evaluations) {
  return {
    schemesEvaluated: evaluations.length,
    schemes: evaluations.map(({ scheme, evaluation, stale }) => ({
      schemeCode: scheme.schemeCode,
      name: scheme.name,
      shortName: scheme.shortName,
      ministry: scheme.ministry,
      schemeLevel: scheme.schemeLevel,
      status: scheme.status,
      benefitsSummary: scheme.benefitsSummary,
      officialSourceUrl: scheme.officialSourceUrl,
      applicationUrl: scheme.applicationUrl,
      applicationMode: scheme.applicationMode,
      requiredDocuments: scheme.requiredDocuments ?? [],
      applicationSteps: scheme.applicationSteps ?? [],
      eligibility: {
        status: evaluation.status,
        matchedRules: evaluation.matchedRules,
        unmatchedRules: evaluation.unmatchedRules,
        missingInformation: evaluation.missingInformation,
      },
      isDemo: scheme.isDemo,
      stale,
      lastVerifiedAt: scheme.lastVerifiedAt,
    })),
  }
}
