/**
 * Chat controller — Phase 9 update.
 *
 * Updated to:
 *   - Apply contextMiddleware before processing (provides farmerContext).
 *   - Pass farmerContext and userId from res.locals to chat service.
 *   - Return extended response with routing, agentActivity, sources.
 *
 * Maps AI provider errors to structured HTTP responses.
 * Controllers must not call individual agents or providers directly.
 */
import { processChat } from '../services/chat.service.js'
import { contextMiddleware } from '../middleware/context.middleware.js'
import { success, error } from '../utils/apiResponse.js'

// AI error codes that map to specific HTTP responses
const AI_ERROR_HTTP_MAP = {
  AI_AUTH_ERROR: 502,
  AI_CONFIGURATION_ERROR: 500,
  AI_RATE_LIMIT: 429,
  AI_TIMEOUT: 504,
  AI_PROVIDER_ERROR: 502,
  AI_RESPONSE_ERROR: 502,
}

/**
 * Chat handler.
 * Relies on contextMiddleware being applied before this handler.
 */
export async function chat(req, res) {
  const { message = '', language = 'en', conversationId = null, attachments = [] } = req.body
  const requestId = res.locals.requestId
  const userId = res.locals.userId ?? req.body.userId ?? 'demo-user'
  const farmerContext = res.locals.farmerContext ?? null
  const memoryContext = res.locals.memoryContext ?? null

  if (!message.trim() && attachments.length === 0) {
    return error(res, 'VALIDATION_ERROR', 'Message or attachment is required', 400)
  }

  try {
    const result = await processChat(
      message,
      conversationId,
      language,
      userId,
      requestId,
      farmerContext,
      attachments,
      memoryContext
    )
    return success(res, result)
  } catch (err) {
    const statusCode = AI_ERROR_HTTP_MAP[err.code] ?? 500
    const code = err.code ?? 'INTERNAL_ERROR'
    const message_str = err.message ?? 'An unexpected error occurred'
    return error(res, code, message_str, statusCode)
  }
}

// Export contextMiddleware so the route can apply it directly
export { contextMiddleware }
