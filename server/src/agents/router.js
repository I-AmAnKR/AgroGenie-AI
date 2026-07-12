/**
 * Agent Router — Phase 9.
 *
 * The single entry point for all AI calls from the Chat Service.
 * Controllers MUST NOT call individual agents directly.
 *
 * Routing flow:
 *   1. Normalize input
 *   2. Classify intent (deterministic rules first, then Granite)
 *   3. Inspect missing information
 *   4. Dispatch to appropriate agent
 *   5. Handle unavailable agents safely
 *   6. Normalize result
 *   7. Return with routing metadata + agent activity
 *
 * Safety invariants:
 *   - WEATHER and MARKET intents NEVER fall through to general Granite.
 *   - All agent results are validated and normalized before return.
 *   - Classifier failure triggers safe fallback (CLARIFICATION or GENERAL).
 *   - No raw SDK errors, credentials, or chain-of-thought in responses.
 *
 * Routing interface:
 *   route({ message, language, userId, conversationId, farmerContext, conversationHistory })
 *
 * Result interface: see agentResult.js for the full contract.
 * Router augments the result with:
 *   routing: { intent, confidenceCategory, classifiedBy }
 */
import { classifyIntent } from './classifier/intent.classifier.js'
import { runGeneralAgent } from './general/general.agent.js'
import { runKnowledgeAgent } from './knowledge/knowledge.agent.js'
import { runWeatherAgent } from './weather/weather.agent.js'
import { runMarketAgent } from './market/market.agent.js'
import { runSchemeAgent } from './scheme/scheme.agent.js'
import { runCropAgent } from './crop/crop.agent.js'
import { runDiseaseAgent } from './disease/disease.agent.js'
import { runOrchestrator } from './orchestration/orchestrator.js'
import { createAgentResult, normalizeAgentResult } from './agentResult.js'
import { INTENT, RESULT_STATUS } from './intents.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── Routing metrics (lightweight internal counters) ───────────────────────────

const _metrics = {
  intentCounts: {},
  agentSelectionCounts: {},
  clarificationCount: 0,
  ragGroundedCount: 0,
  agentFailureCount: 0,
  totalDurationMs: 0,
  requestCount: 0,
}

/**
 * Record routing metrics for observability.
 * Does not throw — metrics failures must never break routing.
 *
 * @param {object} data
 */
function recordMetrics({ intent, agentsUsed, grounded, durationMs }) {
  try {
    _metrics.requestCount++
    _metrics.totalDurationMs += durationMs
    _metrics.intentCounts[intent] = (_metrics.intentCounts[intent] ?? 0) + 1
    for (const agent of agentsUsed) {
      _metrics.agentSelectionCounts[agent] = (_metrics.agentSelectionCounts[agent] ?? 0) + 1
    }
    if (intent === INTENT.CLARIFICATION) _metrics.clarificationCount++
    if (grounded) _metrics.ragGroundedCount++
  } catch {
    // Metrics must never interrupt routing
  }
}

/**
 * Get current routing metrics snapshot.
 * Safe to expose in health/debug endpoints.
 *
 * @returns {object}
 */
export function getRoutingMetrics() {
  return { ..._metrics }
}

// ── Clarification handler ─────────────────────────────────────────────────────

/**
 * Build a CLARIFICATION response when the request is too ambiguous.
 *
 * @param {object} classification - Classifier output
 * @returns {object} Normalized agent result
 */
function buildClarificationResult(classification) {
  const missing = classification.missingInformation ?? []

  const missingSection =
    missing.length > 0
      ? `\n\nTo help you better, could you share:\n${missing.map((f, i) => `${i + 1}. ${f}`).join('\n')}`
      : ''

  return normalizeAgentResult(
    createAgentResult({
      intent: INTENT.CLARIFICATION,
      status: RESULT_STATUS.NEEDS_CLARIFICATION,
      answer:
        "I'd like to help, but I need a bit more information to understand what you're asking." +
        missingSection +
        '\n\nFeel free to describe your farming situation or specific question in more detail.',
      agentsUsed: ['AgentRouter'],
      sources: [],
      grounded: false,
      missingInformation: missing,
      // Reflect mock mode so isDemo stays consistent across all result types
      isDemo: config.providers.useMocks,
      provider: config.providers.useMocks ? 'mock' : null,
    })
  )
}

// ── Agent dispatch table ──────────────────────────────────────────────────────

/**
 * Dispatch a single intent to its corresponding agent.
 * This function is also passed to the orchestrator for MULTI_INTENT dispatch.
 *
 * @param {object} params
 * @returns {Promise<object>} Normalized agent result
 */
async function dispatchAgent({
  intent,
  message,
  language,
  farmerContext,
  memoryContext,
  conversationHistory,
  attachments = [],
  classifierResult,
  metadata,
}) {
  switch (intent) {
    case INTENT.GENERAL:
      return runGeneralAgent({ message, language, farmerContext, memoryContext, conversationHistory, metadata })

    case INTENT.KNOWLEDGE:
      return runKnowledgeAgent({ message, language, farmerContext, memoryContext, metadata })

    case INTENT.WEATHER:
      return runWeatherAgent({ message, language, farmerContext, memoryContext, metadata })

    case INTENT.MARKET:
      return runMarketAgent({ message, farmerContext, memoryContext, metadata })

    case INTENT.SCHEME:
      return runSchemeAgent({ message, farmerContext, memoryContext, metadata })

    case INTENT.CROP_RECOMMENDATION:
      return runCropAgent({
        message,
        farmerContext,
        memoryContext,
        classifierMissingInfo: classifierResult?.missingInformation ?? [],
        metadata,
      })

    case INTENT.DISEASE:
      return runDiseaseAgent({ message, language, farmerContext, memoryContext, attachments, metadata })

    case INTENT.CLARIFICATION:
      return buildClarificationResult(classifierResult ?? {})

    case INTENT.MULTI_INTENT:
      return runOrchestrator({
        message,
        subIntents: classifierResult?.secondaryIntents ?? [],
        language,
        farmerContext,
        memoryContext,
        conversationHistory,
        dispatchAgent: (subParams) =>
          dispatchAgent({ ...subParams, classifierResult, metadata }),
        metadata,
      })

    default: {
      logger.warn('AgentRouter: unknown intent — defaulting to GENERAL', {
        requestId: metadata?.requestId,
        intent,
      })
      return runGeneralAgent({ message, language, farmerContext, memoryContext, conversationHistory, metadata })
    }
  }
}

// ── Main route function ───────────────────────────────────────────────────────

/**
 * Route a farmer message through the Agent Router.
 *
 * @param {object} params
 * @param {string} params.message - Farmer's message text
 * @param {string} [params.language='en'] - Language code
 * @param {string} [params.userId='anonymous'] - User identifier
 * @param {string|null} [params.conversationId=null] - Conversation ID for logging
 * @param {object} [params.farmerContext={}] - Normalized FarmerProfile context
 * @param {Array<{role, content}>} [params.conversationHistory=[]] - Prior turns
 * @param {object} [params.metadata={}] - Request metadata for logging
 * @returns {Promise<{result: object, routing: object}>}
 */
export async function route({
  message,
  language = 'en',
  userId = 'anonymous',
  conversationId = null,
  farmerContext = {},
  memoryContext = null,
  conversationHistory = [],
  attachments = [],
  metadata = {},
}) {
  const start = Date.now()
  const routingMetadata = { ...metadata, userId, conversationId }

  logger.info('AgentRouter: routing request', {
    requestId: metadata.requestId,
    conversationId,
    messageLength: message?.length ?? 0,
  })

  // ── Step 1: Validate message ──────────────────────────────────────────────
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    const result = normalizeAgentResult(
      createAgentResult({
        intent: INTENT.CLARIFICATION,
        status: RESULT_STATUS.NEEDS_CLARIFICATION,
        answer: 'Please share a question or describe what farming assistance you need.',
        agentsUsed: ['AgentRouter'],
      })
    )
    return {
      result,
      routing: {
        intent: INTENT.CLARIFICATION,
        confidenceCategory: 'high',
        classifiedBy: 'validation',
      },
    }
  }

  // ── Step 2: Classify intent ───────────────────────────────────────────────
  let classification
  try {
    classification = await classifyIntent({
      message: message ? message.trim() : '',
      farmerContext,
      attachments,
      metadata: routingMetadata,
    })
  } catch (err) {
    logger.error('AgentRouter: classifier failed', {
      requestId: metadata.requestId,
      code: err.code ?? 'UNKNOWN',
    })
    // Safe fallback — do not crash the chat
    classification = {
      primaryIntent: INTENT.GENERAL,
      secondaryIntents: [],
      confidenceCategory: 'low',
      missingInformation: [],
      requiresLiveData: false,
      requiresKnowledgeRetrieval: false,
    }
  }

  const { primaryIntent, confidenceCategory } = classification

  logger.info('AgentRouter: intent classified', {
    requestId: metadata.requestId,
    intent: primaryIntent,
    confidence: confidenceCategory,
    requiresLiveData: classification.requiresLiveData,
  })

  // ── Step 3: Dispatch to agent ─────────────────────────────────────────────
  let result
  try {
    result = await dispatchAgent({
      intent: primaryIntent,
      message: message ? message.trim() : '',
      language,
      farmerContext,
      conversationHistory,
      attachments,
      classifierResult: classification,
      metadata: routingMetadata,
    })
  } catch (err) {
    logger.error('AgentRouter: agent dispatch failed', {
      requestId: metadata.requestId,
      intent: primaryIntent,
      code: err.code ?? 'UNKNOWN',
    })
    _metrics.agentFailureCount++
    result = normalizeAgentResult(
      createAgentResult({
        intent: primaryIntent,
        status: RESULT_STATUS.FAILED,
        answer:
          'I encountered an error while processing your request. ' +
          'Please try again. If the issue persists, consult your local Krishi Vigyan Kendra (KVK).',
        agentsUsed: ['AgentRouter'],
        warnings: ['Agent processing failed.'],
      })
    )
  }

  const durationMs = Date.now() - start

  // ── Step 4: Record metrics ────────────────────────────────────────────────
  recordMetrics({
    intent: result.intent,
    agentsUsed: result.agentsUsed,
    grounded: result.grounded,
    durationMs,
  })

  logger.info('AgentRouter: routing complete', {
    requestId: metadata.requestId,
    intent: result.intent,
    status: result.status,
    agentsUsed: result.agentsUsed,
    grounded: result.grounded,
    sourceCount: result.sources?.length ?? 0,
    isDemo: result.isDemo,
    durationMs,
  })

  return {
    result,
    routing: {
      intent: result.intent,
      confidenceCategory,
      classifiedBy: classification._classifiedBy ?? 'classifier',
    },
  }
}
