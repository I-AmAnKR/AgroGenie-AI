/**
 * Intent classifier schema — Phase 9.
 *
 * Defines the expected structure of the classifier JSON output
 * and provides validation utilities.
 */
import { ALL_INTENTS, CONFIDENCE } from '../intents.js'

/**
 * Expected classifier output shape:
 * {
 *   primaryIntent: string,         — one of INTENT values
 *   secondaryIntents: string[],    — additional intents for MULTI_INTENT
 *   confidenceCategory: string,    — 'high' | 'medium' | 'low'
 *   missingInformation: string[],  — fields needed but absent for safe routing
 *   requiresLiveData: boolean,     — true if live weather/market data needed
 *   requiresKnowledgeRetrieval: boolean — true if RAG retrieval needed
 * }
 */

/**
 * Validate classifier output object.
 * Returns { valid: true } or { valid: false, reason: string }.
 *
 * @param {unknown} output - Parsed object from Granite classifier response
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateClassifierOutput(output) {
  if (!output || typeof output !== 'object') {
    return { valid: false, reason: 'Output is not an object' }
  }

  if (!output.primaryIntent) {
    return { valid: false, reason: 'Missing primaryIntent' }
  }

  if (!ALL_INTENTS.has(output.primaryIntent)) {
    return { valid: false, reason: `Unknown primaryIntent: ${output.primaryIntent}` }
  }

  if (!Array.isArray(output.secondaryIntents)) {
    return { valid: false, reason: 'secondaryIntents must be an array' }
  }

  for (const si of output.secondaryIntents) {
    if (!ALL_INTENTS.has(si)) {
      return { valid: false, reason: `Unknown secondaryIntent: ${si}` }
    }
  }

  const validConfidence = new Set(Object.values(CONFIDENCE))
  if (output.confidenceCategory && !validConfidence.has(output.confidenceCategory)) {
    return { valid: false, reason: `Unknown confidenceCategory: ${output.confidenceCategory}` }
  }

  if (!Array.isArray(output.missingInformation)) {
    return { valid: false, reason: 'missingInformation must be an array' }
  }

  return { valid: true }
}

/**
 * Normalize raw classifier output to the canonical schema.
 * Fills in defaults for any missing optional fields.
 *
 * @param {object} raw - Partially-valid classifier output
 * @returns {object} Normalized classifier result
 */
export function normalizeClassifierOutput(raw) {
  return {
    primaryIntent: raw.primaryIntent,
    secondaryIntents: Array.isArray(raw.secondaryIntents) ? raw.secondaryIntents : [],
    confidenceCategory: raw.confidenceCategory ?? 'medium',
    missingInformation: Array.isArray(raw.missingInformation) ? raw.missingInformation : [],
    requiresLiveData: raw.requiresLiveData === true,
    requiresKnowledgeRetrieval: raw.requiresKnowledgeRetrieval === true,
  }
}
