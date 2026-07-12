/**
 * AI development-only test routes.
 *
 * POST /api/v1/ai/test
 *   Calls the active AI provider directly and returns the normalized response.
 *   Available ONLY in development mode (NODE_ENV=development).
 *   Not mounted in production — does not pollute the production route table.
 *
 * This endpoint is intentionally NOT gated by auth in Step 6.
 * Add authentication before promoting to staging.
 */
import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { validate } from '../middleware/validate.middleware.js'
import { getAiProvider } from '../providers/ai.provider.factory.js'
import { buildSystemPrompt } from '../prompts/agrogenie.system.prompt.js'
import { success, error } from '../utils/apiResponse.js'
import config from '../config/env.js'

const router = Router()

const AI_ERROR_HTTP_MAP = {
  AI_AUTH_ERROR: 502,
  AI_CONFIGURATION_ERROR: 500,
  AI_RATE_LIMIT: 429,
  AI_TIMEOUT: 504,
  AI_PROVIDER_ERROR: 502,
  AI_RESPONSE_ERROR: 502,
}

router.post(
  '/test',
  validate([
    { field: 'message', required: true, type: 'string', minLength: 1 },
    { field: 'language', required: false, type: 'string' },
  ]),
  asyncHandler(async (req, res) => {
    if (!config.server.isDev) {
      return error(res, 'NOT_FOUND', 'This endpoint is only available in development mode.', 404)
    }

    const { message, language = 'en' } = req.body
    const requestId = res.locals.requestId

    let aiResult
    try {
      const provider = getAiProvider()
      aiResult = await provider.generate({
        messages: [{ role: 'user', content: message }],
        systemPrompt: buildSystemPrompt(language),
        parameters: {},
        metadata: { requestId, source: 'ai-test-endpoint' },
      })
    } catch (err) {
      const statusCode = AI_ERROR_HTTP_MAP[err.code] ?? 500
      return error(res, err.code ?? 'AI_PROVIDER_ERROR', err.message ?? 'AI provider error', statusCode)
    }

    return success(res, {
      content: aiResult.content,
      model: aiResult.model,
      provider: aiResult.provider,
      usage: aiResult.usage,
      finishReason: aiResult.finishReason,
      isDemo: aiResult.isDemo,
    })
  })
)

export default router
