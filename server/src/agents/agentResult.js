/**
 * Agent result normalization — Phase 9.
 *
 * All agents return results conforming to this contract.
 * The Agent Router uses normalizeAgentResult() to ensure every response
 * has the expected shape before returning it to the Chat Service.
 *
 * Result contract:
 * {
 *   intent: string,              — INTENT constant
 *   status: string,              — RESULT_STATUS constant
 *   answer: string,              — User-facing answer text
 *   agentsUsed: string[],        — Human-readable list of agents/capabilities used
 *   sources: object[],           — RAG source cards (empty for non-RAG answers)
 *   grounded: boolean,           — true only when actual retrieval occurred
 *   missingInformation: string[], — Fields needed for a better answer
 *   warnings: string[],          — Non-blocking warnings for the user
 *   provider: string|null,       — AI provider used ('watsonx', 'mock', null)
 *   model: string|null,          — Model ID used
 *   retrieval: object|null,      — { chunksRetrieved, documentsUsed } for KNOWLEDGE
 *   isDemo: boolean,             — true when mock provider was used
 * }
 */
import { RESULT_STATUS, INTENT } from './intents.js'

/**
 * Create a canonical empty agent result.
 * Use this as the base and override the fields you need.
 *
 * @param {Partial<object>} overrides
 * @returns {object}
 */
export function createAgentResult(overrides = {}) {
  return {
    intent: INTENT.GENERAL,
    status: RESULT_STATUS.SUCCESS,
    answer: '',
    agentsUsed: [],
    sources: [],
    grounded: false,
    missingInformation: [],
    warnings: [],
    provider: null,
    model: null,
    retrieval: null,
    isDemo: false,
    ...overrides,
  }
}

/**
 * Validate an agent result object.
 * Returns { valid: true } or { valid: false, reason }.
 *
 * @param {object} result
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateAgentResult(result) {
  if (!result || typeof result !== 'object') {
    return { valid: false, reason: 'Result is not an object' }
  }
  if (!result.intent) return { valid: false, reason: 'Missing intent' }
  if (!result.status) return { valid: false, reason: 'Missing status' }
  if (typeof result.answer !== 'string') return { valid: false, reason: 'answer must be a string' }
  if (!Array.isArray(result.agentsUsed)) return { valid: false, reason: 'agentsUsed must be an array' }
  if (!Array.isArray(result.sources)) return { valid: false, reason: 'sources must be an array' }
  return { valid: true }
}

/**
 * Normalize an agent result — fill in defaults for any missing fields.
 * Used by the Agent Router before returning results to the Chat Service.
 *
 * @param {object} result - Partial or complete agent result
 * @returns {object} Fully normalized agent result
 */
export function normalizeAgentResult(result) {
  const base = createAgentResult()
  const normalized = { ...base, ...result }

  // Type coercions for safety
  normalized.sources = Array.isArray(normalized.sources) ? normalized.sources : []
  normalized.agentsUsed = Array.isArray(normalized.agentsUsed) ? normalized.agentsUsed : []
  normalized.missingInformation = Array.isArray(normalized.missingInformation) ? normalized.missingInformation : []
  normalized.warnings = Array.isArray(normalized.warnings) ? normalized.warnings : []
  normalized.grounded = normalized.grounded === true
  normalized.isDemo = normalized.isDemo === true
  normalized.answer = typeof normalized.answer === 'string' ? normalized.answer : String(normalized.answer ?? '')

  return normalized
}
