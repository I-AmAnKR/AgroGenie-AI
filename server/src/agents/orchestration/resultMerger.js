/**
 * Result Merger — Phase 9 Orchestration.
 *
 * Merges multiple agent results from a MULTI_INTENT query into a single
 * normalized agent result for the user.
 *
 * Design:
 *   - Collects answers from each sub-agent.
 *   - Clearly labels each section so the user knows which sub-question is answered.
 *   - Merges agentsUsed across all results.
 *   - Merges sources (deduplicated by documentId).
 *   - grounded = true only if ANY sub-result was grounded.
 *   - status = partial_success if any sub-agent returned non-success.
 *   - status = success if all sub-agents returned success.
 *   - Merges all warnings.
 *   - isDemo = true if any sub-result came from a mock provider.
 */
import { createAgentResult, normalizeAgentResult } from '../agentResult.js'
import { INTENT, RESULT_STATUS } from '../intents.js'
import logger from '../../utils/logger.js'

/**
 * Deduplicate sources across multiple agent results by documentId.
 *
 * @param {object[][]} sourceArrays - Arrays of source objects from each agent
 * @returns {object[]} Deduplicated source list
 */
function mergeSources(sourceArrays) {
  const seen = new Map()
  for (const arr of sourceArrays) {
    for (const src of arr) {
      const key = src.documentId ?? src.title ?? JSON.stringify(src)
      if (!seen.has(key)) seen.set(key, src)
    }
  }
  return Array.from(seen.values())
}

/**
 * Intent-to-section label for multi-intent answer formatting.
 */
const INTENT_LABELS = {
  [INTENT.WEATHER]: 'Weather',
  [INTENT.MARKET]: 'Market Prices',
  [INTENT.SCHEME]: 'Government Schemes',
  [INTENT.CROP_RECOMMENDATION]: 'Crop Recommendation',
  [INTENT.DISEASE]: 'Plant Health',
  [INTENT.KNOWLEDGE]: 'Knowledge Base',
  [INTENT.GENERAL]: 'General',
  [INTENT.CLARIFICATION]: 'Additional Information Needed',
}

/**
 * Merge multiple agent results into a single MULTI_INTENT result.
 *
 * @param {object[]} agentResults - Array of normalized agent results
 * @param {object} [metadata={}] - Request metadata for logging
 * @returns {object} Merged normalized agent result
 */
export function mergeAgentResults(agentResults, metadata = {}) {
  if (!agentResults || agentResults.length === 0) {
    logger.warn('ResultMerger: no results to merge', { requestId: metadata.requestId })
    return normalizeAgentResult(
      createAgentResult({
        intent: INTENT.MULTI_INTENT,
        status: RESULT_STATUS.FAILED,
        answer: 'The multi-intent request could not be processed.',
        agentsUsed: ['Orchestrator'],
      })
    )
  }

  if (agentResults.length === 1) {
    return agentResults[0]
  }

  // Build merged answer with labelled sections
  const sections = agentResults.map((r) => {
    const label = INTENT_LABELS[r.intent] ?? r.intent
    return `**${label}:**\n${r.answer}`
  })
  const mergedAnswer = sections.join('\n\n---\n\n')

  // Merge agentsUsed (deduplicated)
  const allAgents = [...new Set(agentResults.flatMap((r) => r.agentsUsed))]

  // Merge sources
  const mergedSources = mergeSources(agentResults.map((r) => r.sources ?? []))

  // Merge warnings
  const allWarnings = agentResults.flatMap((r) => r.warnings ?? [])

  // Status: success only if all succeeded
  const allSucceeded = agentResults.every((r) => r.status === RESULT_STATUS.SUCCESS)
  const status = allSucceeded ? RESULT_STATUS.SUCCESS : RESULT_STATUS.PARTIAL_SUCCESS

  // grounded: true if any sub-result was grounded
  const grounded = agentResults.some((r) => r.grounded === true)

  // isDemo: true if any sub-result came from a mock provider
  const isDemo = agentResults.some((r) => r.isDemo === true)

  // Dominant provider (first non-null)
  const provider = agentResults.find((r) => r.provider)?.provider ?? null
  const model = agentResults.find((r) => r.model)?.model ?? null

  logger.debug('ResultMerger: merged multi-intent results', {
    requestId: metadata.requestId,
    subResultCount: agentResults.length,
    status,
    grounded,
  })

  return normalizeAgentResult(
    createAgentResult({
      intent: INTENT.MULTI_INTENT,
      status,
      answer: mergedAnswer,
      agentsUsed: ['Orchestrator', ...allAgents],
      sources: mergedSources,
      grounded,
      warnings: allWarnings,
      provider,
      model,
      isDemo,
    })
  )
}
