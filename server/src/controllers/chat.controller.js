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
import { getStorageProvider } from '../providers/storage.provider.factory.js'
import { v4 as uuidv4 } from 'uuid'
import config from '../config/env.js'
import logger from '../utils/logger.js'

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
  let { message = '', language = 'en', conversationId = null, attachments = [] } = req.body
  const requestId = res.locals.requestId
  const userId = res.locals.userId ?? req.body.userId ?? 'demo-user'
  const farmerContext = res.locals.farmerContext ?? null
  const memoryContext = res.locals.memoryContext ?? null

  // Ensure attachments is an array if passed as a JSON string in a multipart form
  if (typeof attachments === 'string') {
    try {
      attachments = JSON.parse(attachments)
    } catch {
      attachments = []
    }
  }

  // Handle uploaded files via multer
  if (req.files && req.files.length > 0) {
    try {
      const storageProvider = getStorageProvider()
      
      const uploadedAttachments = await Promise.all(
        req.files.map(async (file) => {
          const id = uuidv4()
          const safeName = file.originalname.toLowerCase().replace(/[^a-z0-9._-]/g, '_').slice(0, 100)
          const objectKey = `chat-attachments/${id}-${safeName}`
          
          await storageProvider.uploadObject(objectKey, file.buffer, file.mimetype, {
            originalname: file.originalname,
            category: 'chat-attachment',
            uploadedby: userId
          })
          
          return {
            type: file.mimetype.startsWith('image/') ? 'image' : 'document',
            objectKey: objectKey,
            mimeType: file.mimetype,
            originalName: file.originalname
          }
        })
      )
      
      attachments = [...(Array.isArray(attachments) ? attachments : []), ...uploadedAttachments]
    } catch (uploadErr) {
      logger.error('Failed to upload chat attachments to COS', { error: uploadErr.message, requestId })
      return error(res, 'UPLOAD_ERROR', 'Failed to upload attachments', 500)
    }
  }

  if (!message.trim() && (!attachments || attachments.length === 0)) {
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
