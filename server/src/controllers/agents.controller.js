/**
 * Agents controller — Phase 9.
 *
 * Provides a development-only route-test endpoint for verifying intent
 * classification without executing the full agent pipeline.
 *
 * Endpoints:
 *   POST /api/v1/agents/route-test  — classify intent only (dev mode)
 */
import { classifyIntent } from '../agents/classifier/intent.classifier.js'
import { normalizeFarmerContext } from '../middleware/context.middleware.js'
import { getProfile } from '../services/profile.service.js'
import { getRoutingMetrics } from '../agents/router.js'
import { success, error } from '../utils/apiResponse.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

/**
 * Route-test handler — development only.
 * Classifies the intent of a message without executing the agent pipeline.
 *
 * POST /api/v1/agents/route-test
 * Body: { message: string, userId?: string }
 */
export async function routeTest(req, res) {
  // Guard: development mode only
  if (!config.server.isDev) {
    return error(res, 'NOT_FOUND', 'Endpoint not available in production mode.', 404)
  }

  const { message, userId = 'demo-user' } = req.body
  const requestId = res.locals.requestId

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return error(res, 'VALIDATION_ERROR', 'message is required', 400)
  }

  try {
    let farmerContext = {}
    try {
      const rawProfile = await getProfile(userId)
      farmerContext = normalizeFarmerContext(rawProfile)
    } catch {
      // Continue with empty context
    }

    const classification = await classifyIntent({
      message: message.trim(),
      farmerContext,
      metadata: { requestId },
    })

    logger.debug('route-test: classification complete', {
      requestId,
      intent: classification.primaryIntent,
    })

    return success(res, {
      primaryIntent: classification.primaryIntent,
      secondaryIntents: classification.secondaryIntents,
      confidenceCategory: classification.confidenceCategory,
      missingInformation: classification.missingInformation,
      requiresLiveData: classification.requiresLiveData,
      requiresKnowledgeRetrieval: classification.requiresKnowledgeRetrieval,
    })
  } catch (err) {
    logger.error('route-test: classification failed', {
      requestId,
      code: err.code ?? 'UNKNOWN',
    })
    return error(res, err.code ?? 'INTERNAL_ERROR', err.message ?? 'Classification failed', 500)
  }
}

/**
 * Routing metrics handler — development only.
 * Returns current routing metrics counters.
 *
 * GET /api/v1/agents/metrics
 */
export async function routingMetrics(req, res) {
  if (!config.server.isDev) {
    return error(res, 'NOT_FOUND', 'Endpoint not available in production mode.', 404)
  }
  return success(res, getRoutingMetrics())
}
