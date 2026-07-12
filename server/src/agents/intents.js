/**
 * Intent constants — Phase 9 Agent Router.
 *
 * Central definition of all routing intents.
 * Import this module wherever intent values are compared or constructed.
 *
 * Semantics:
 *   GENERAL            — General agricultural education; Granite pretrained knowledge only.
 *   KNOWLEDGE          — Retrieval from uploaded knowledge documents (RAG pipeline).
 *   WEATHER            — Requires current/forecast weather data (live provider).
 *   MARKET             — Requires mandi/market price data (live provider).
 *   SCHEME             — Verified government scheme information (RAG or live provider).
 *   CROP_RECOMMENDATION — Personalized crop suitability reasoning.
 *   DISEASE            — Plant-health, symptom analysis, image-based diagnosis.
 *   MULTI_INTENT       — Message contains multiple independent specialized requests.
 *   CLARIFICATION      — Cannot route safely without additional farmer information.
 */

export const INTENT = {
  GENERAL: 'GENERAL',
  KNOWLEDGE: 'KNOWLEDGE',
  WEATHER: 'WEATHER',
  MARKET: 'MARKET',
  SCHEME: 'SCHEME',
  CROP_RECOMMENDATION: 'CROP_RECOMMENDATION',
  DISEASE: 'DISEASE',
  MULTI_INTENT: 'MULTI_INTENT',
  CLARIFICATION: 'CLARIFICATION',
}

/** All valid intent values as a Set for fast membership checks. */
export const ALL_INTENTS = new Set(Object.values(INTENT))

/**
 * Intents that require live external data.
 * Queries classified as these must NOT be silently routed to general Granite.
 */
export const LIVE_DATA_INTENTS = new Set([INTENT.WEATHER, INTENT.MARKET])

/**
 * Intents that require specialized capabilities not yet available.
 * Each will return capability_not_available with a safe explanation.
 * NOTE: WEATHER was removed from this set in Phase 10 (live agent implemented).
 * NOTE: MARKET was removed from this set in Phase 11 (live agent implemented).
 * NOTE: SCHEME was removed from this set in Phase 12 (live agent implemented).
 * NOTE: CROP_RECOMMENDATION was removed from this set in Phase 13 (live agent implemented).
 */
export const CAPABILITY_NOT_AVAILABLE_INTENTS = new Set([
  INTENT.DISEASE,
])


/** Confidence category labels. */
export const CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
}

/** Agent result status codes. */
export const RESULT_STATUS = {
  SUCCESS: 'success',
  PARTIAL_SUCCESS: 'partial_success',
  NEEDS_CLARIFICATION: 'needs_clarification',
  CAPABILITY_NOT_AVAILABLE: 'capability_not_available',
  FAILED: 'failed',
}
