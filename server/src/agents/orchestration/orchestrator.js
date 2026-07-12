/**
 * Orchestrator — Phase 9.
 *
 * Handles MULTI_INTENT queries by:
 *   1. Validating sub-intents from the classifier.
 *   2. Dispatching each sub-intent to its registered agent.
 *   3. Collecting all sub-results concurrently where safe.
 *   4. Merging results via resultMerger.
 *   5. Preserving per-agent warnings and sources.
 *
 * Design for future phases:
 *   - When Phase 10 (Weather) and Phase 11 (Market) are implemented, their agents
 *     are already registered in the agent dispatch table in router.js.
 *   - No orchestrator rewrites needed — new agents simply plug in.
 *
 * At Phase 9, Weather and Market agents return capability_not_available.
 * The orchestrator handles partial results gracefully — status becomes partial_success.
 *
 * Concurrency:
 *   Sub-agents are dispatched in parallel using Promise.allSettled.
 *   A single failing agent does not crash the entire multi-intent response.
 */
import { mergeAgentResults } from './resultMerger.js'
import { createAgentResult, normalizeAgentResult } from '../agentResult.js'
import { INTENT, RESULT_STATUS, ALL_INTENTS } from '../intents.js'
import logger from '../../utils/logger.js'

/**
 * Run the orchestrator for a MULTI_INTENT query.
 *
 * @param {object} params
 * @param {string} params.message - Original user message
 * @param {string[]} params.subIntents - Validated sub-intents from classifier
 * @param {string} [params.language='en']
 * @param {object} [params.farmerContext={}]
 * @param {Array<{role, content}>} [params.conversationHistory=[]]
 * @param {Function} params.dispatchAgent - Agent dispatch function from router
 * @param {object} [params.metadata={}]
 * @returns {Promise<object>} Merged normalized agent result
 */
export async function runOrchestrator({
  message,
  subIntents,
  language = 'en',
  farmerContext = {},
  conversationHistory = [],
  dispatchAgent,
  metadata = {},
}) {
  const start = Date.now()

  // Validate sub-intents
  const validSubIntents = (subIntents ?? []).filter((intent) => {
    if (!ALL_INTENTS.has(intent)) {
      logger.warn('Orchestrator: unknown sub-intent skipped', {
        requestId: metadata.requestId,
        intent,
      })
      return false
    }
    if (intent === INTENT.MULTI_INTENT) {
      // Prevent infinite recursion
      logger.warn('Orchestrator: MULTI_INTENT sub-intent skipped to prevent recursion', {
        requestId: metadata.requestId,
      })
      return false
    }
    return true
  })

  if (validSubIntents.length === 0) {
    logger.warn('Orchestrator: no valid sub-intents — falling back to GENERAL', {
      requestId: metadata.requestId,
    })
    return dispatchAgent({
      intent: INTENT.GENERAL,
      message,
      language,
      farmerContext,
      conversationHistory,
      metadata,
    })
  }

  logger.info('Orchestrator: dispatching sub-intents', {
    requestId: metadata.requestId,
    subIntents: validSubIntents,
  })

  // Dispatch all sub-agents in parallel
  const settled = await Promise.allSettled(
    validSubIntents.map((intent) =>
      dispatchAgent({
        intent,
        message,
        language,
        farmerContext,
        conversationHistory,
        metadata,
      })
    )
  )

  // Collect results; create failure placeholders for rejected agents
  const subResults = settled.map((outcome, idx) => {
    if (outcome.status === 'fulfilled') {
      return outcome.value
    }
    const intent = validSubIntents[idx]
    logger.error('Orchestrator: sub-agent failed', {
      requestId: metadata.requestId,
      intent,
      error: outcome.reason?.code ?? 'UNKNOWN',
    })
    return normalizeAgentResult(
      createAgentResult({
        intent,
        status: RESULT_STATUS.FAILED,
        answer: `The ${intent.toLowerCase()} agent encountered an error and could not respond.`,
        agentsUsed: [],
        warnings: [`${intent} agent failed to respond.`],
      })
    )
  })

  const merged = mergeAgentResults(subResults, metadata)

  logger.info('Orchestrator: complete', {
    requestId: metadata.requestId,
    subIntentCount: validSubIntents.length,
    status: merged.status,
    durationMs: Date.now() - start,
  })

  return merged
}
