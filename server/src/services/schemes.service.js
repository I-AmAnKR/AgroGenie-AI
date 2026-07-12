/**
 * Government Scheme service — Phase 12.
 *
 * Replaces the Phase 4 placeholder.
 *
 * Responsibilities:
 *   - Scheme discovery: find candidate schemes matching farmer context
 *   - Eligibility evaluation: deterministic rule engine (not LLM)
 *   - RAG context retrieval: search indexed government-scheme documents
 *   - Stale-data detection: warns if lastVerifiedAt is beyond threshold
 *
 * Architecture contract:
 *   Scheme Agent → Scheme Service → { scheme.repository, schemeEligibility, rag.service }
 *
 * Safety rules:
 *   - The LLM is NEVER called from this service. It is the agent's job.
 *   - This service never invents eligibility decisions.
 *   - All scheme fields come from repository records, not fabricated.
 *   - isDemo flag propagates through every response object.
 */
import {
  findCandidatesForFarmer,
  findByCode,
  findActive,
  findByCategory,
  findByState,
  search as repoSearch,
} from '../repositories/scheme.repository.js'
import { evaluateEligibility, ELIGIBILITY_STATUS } from './schemeEligibility.service.js'
import { searchKnowledge } from './rag.service.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── RAG filter for scheme documents ──────────────────────────────────────────
// This is the exact filter value used in findAllChunksWithVectors(filters).
// The chunk.category field must equal this string for government-scheme documents.
const SCHEME_RAG_CATEGORY = 'knowledge/government-schemes'

// ── Staleness detection ───────────────────────────────────────────────────────

/**
 * Check whether a scheme's verification is stale.
 * Returns true if lastVerifiedAt is older than SCHEME_VERIFICATION_STALE_DAYS
 * or if lastVerifiedAt is not set.
 *
 * @param {object} scheme
 * @returns {boolean}
 */
function isVerificationStale(scheme) {
  const staleDays = config.scheme?.verificationStaleDays ?? 90
  if (!scheme.lastVerifiedAt) return true

  const lastVerified = new Date(scheme.lastVerifiedAt)
  if (isNaN(lastVerified.getTime())) return true

  const daysSince = (Date.now() - lastVerified.getTime()) / (1000 * 60 * 60 * 24)
  return daysSince > staleDays
}

/**
 * Build a stale-verification warning message for a scheme.
 *
 * @param {object} scheme
 * @returns {string}
 */
function buildStaleWarning(scheme) {
  const sourceName = scheme.verificationNotes
    ? scheme.verificationNotes
    : 'the official source'
  return (
    `The "${scheme.name}" record has not been verified recently (last checked: ${scheme.lastVerifiedAt ?? 'unknown'}). ` +
    `Please confirm current eligibility, deadlines, and benefit amounts at ${scheme.officialSourceUrl || sourceName}.`
  )
}

// ── Scheme search ─────────────────────────────────────────────────────────────

/**
 * Search schemes by free-text query, optional category, and optional state.
 *
 * @param {object} params
 * @param {string} [params.query='']
 * @param {string} [params.category]
 * @param {string} [params.state]
 * @param {number} [params.limit]
 * @returns {Promise<{ schemes: object[], warnings: string[] }>}
 */
export async function searchSchemes({ query = '', category, state, limit } = {}) {
  const maxResults = limit ?? config.scheme?.searchLimit ?? 10
  let schemes = []

  try {
    if (query && query.trim()) {
      schemes = await repoSearch(query.trim(), maxResults)
    } else if (category) {
      schemes = await findByCategory([category], maxResults)
    } else if (state) {
      schemes = await findByState(state, maxResults)
    } else {
      schemes = await findActive(maxResults)
    }
  } catch (err) {
    logger.error('SchemeService.searchSchemes failed', { error: err.message })
    return { schemes: [], warnings: ['Scheme data is temporarily unavailable.'] }
  }

  const warnings = []
  if (schemes.some((s) => s.isDemo)) {
    warnings.push(
      'Scheme information is based on curated records and may not reflect recent government amendments. ' +
        'Verify current details at the official scheme portal before applying.'
    )
  }

  return { schemes, warnings }
}

/**
 * Find a single scheme by its schemeCode.
 *
 * @param {string} schemeCode
 * @returns {Promise<object|null>}
 */
export async function findSchemeByCode(schemeCode) {
  try {
    return findByCode(schemeCode)
  } catch (err) {
    logger.error('SchemeService.findSchemeByCode failed', { schemeCode, error: err.message })
    return null
  }
}

// ── Candidate discovery ───────────────────────────────────────────────────────

/**
 * Find candidate schemes for a farmer based on their context.
 * Does NOT evaluate eligibility — that is a separate step.
 *
 * @param {object} params
 * @param {object} params.farmerContext - Normalized farmer context
 * @param {string[]} [params.categories=[]] - Optional category hints from query
 * @returns {Promise<{ candidates: object[], warnings: string[] }>}
 */
export async function findCandidates({ farmerContext, categories = [] }) {
  const limit = config.scheme?.searchLimit ?? 10

  let candidates = []
  const warnings = []

  try {
    candidates = await findCandidatesForFarmer(farmerContext, categories, limit)
  } catch (err) {
    logger.error('SchemeService.findCandidates failed', { error: err.message })
    return { candidates: [], warnings: ['Scheme discovery is temporarily unavailable.'] }
  }

  if (candidates.length === 0) {
    warnings.push(
      'No matching scheme records found for your current profile. ' +
        'Contact your local Krishi Vigyan Kendra (KVK) or gram panchayat for guidance.'
    )
  }

  if (candidates.some((s) => s.isDemo)) {
    warnings.push(
      'Scheme information is based on curated records. Verify current details at official portals before applying.'
    )
  }

  return { candidates, warnings }
}

// ── Eligibility evaluation ────────────────────────────────────────────────────

/**
 * Evaluate eligibility for a list of candidate schemes against farmer context.
 * Returns an array of evaluation results — one per scheme.
 *
 * The LLM is NOT called here. The evaluator is purely deterministic.
 *
 * @param {object} params
 * @param {object} params.farmerContext - Normalized farmer context
 * @param {object[]} params.schemes - Array of scheme records
 * @returns {Promise<{ evaluations: object[], warnings: string[] }>}
 */
export async function evaluateSchemes({ farmerContext, schemes }) {
  const warnings = []

  if (!schemes || schemes.length === 0) {
    return { evaluations: [], warnings }
  }

  const evaluations = schemes.map((scheme) => {
    const evaluation = evaluateEligibility({ farmerContext, scheme })

    // Add stale verification warning per scheme if applicable
    const stale = isVerificationStale(scheme)

    return {
      scheme,
      evaluation,
      stale,
      staleWarning: stale ? buildStaleWarning(scheme) : null,
    }
  })

  // Overall stale warning if any scheme is stale
  const anyStale = evaluations.some((e) => e.stale)
  if (anyStale) {
    warnings.push(
      'Some scheme records may not reflect the most recent government amendments. ' +
        'Always verify eligibility at the official scheme portal before applying.'
    )
  }

  return { evaluations, warnings }
}

// ── RAG context retrieval ─────────────────────────────────────────────────────

/**
 * Retrieve supporting context from the knowledge base for scheme questions.
 * Uses the existing rag.service.js with category filter for government-scheme documents.
 *
 * Returns null (not an error) if RAG retrieval is unavailable.
 * Caller must handle the null case gracefully.
 *
 * @param {object} params
 * @param {string} params.question - Farmer's question about schemes
 * @param {string} [params.language='en'] - Preferred language
 * @param {object} [params.metadata={}] - Request metadata for logging
 * @returns {Promise<object|null>} RAG result or null
 */
export async function retrieveSchemeContext({ question, language = 'en', metadata = {} }) {
  const topK = config.scheme?.ragTopK ?? 5

  try {
    const ragResult = await searchKnowledge({
      query: question,
      topK,
      filters: { category: SCHEME_RAG_CATEGORY },
      metadata,
    })

    logger.debug('SchemeService: RAG retrieval complete', {
      requestId: metadata.requestId,
      resultCount: ragResult.resultCount,
      category: SCHEME_RAG_CATEGORY,
    })

    return ragResult
  } catch (err) {
    // RAG is best-effort — log but do not block the scheme agent
    logger.warn('SchemeService: RAG retrieval failed (non-fatal)', {
      requestId: metadata.requestId,
      error: err.message,
    })
    return null
  }
}

// ── Source builder ────────────────────────────────────────────────────────────

/**
 * Build a standardized source card from a scheme record.
 * This is the official source metadata attached to every scheme response.
 *
 * @param {object} scheme
 * @returns {object} Source card
 */
export function buildSchemeSourceCard(scheme) {
  return {
    sourceType: 'government_scheme',
    schemeCode: scheme.schemeCode,
    schemeName: scheme.name,
    officialUrl: scheme.officialSourceUrl || null,
    lastVerifiedAt: scheme.lastVerifiedAt || null,
    isDemo: scheme.isDemo,
    status: scheme.status,
  }
}

// ── Backward-compatible exports ───────────────────────────────────────────────

/**
 * @deprecated Use searchSchemes() instead.
 * Kept for backward compatibility with existing routes that call getSchemeById.
 */
export async function getSchemeById(id) {
  // Old routes pass a MongoDB-style id or schemeCode; try schemeCode path
  const scheme = await findByCode(id)
  if (scheme) return scheme
  // Try to search by id (may be schemeId UUID)
  const col = (await import('../repositories/scheme.repository.js')).findById
  if (typeof col === 'function') {
    return col(id)
  }
  return null
}
