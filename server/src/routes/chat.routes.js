import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { chat, contextMiddleware } from '../controllers/chat.controller.js'
import { validate } from '../middleware/validate.middleware.js'
import { uploadChatAttachmentsMiddleware } from '../middleware/upload.middleware.js'

const router = Router()

// POST /chat
// contextMiddleware loads and normalizes the FarmerProfile before the handler.
// uploadChatAttachmentsMiddleware processes multipart/form-data if present.
router.post(
  '/',
  asyncHandler(contextMiddleware),
  uploadChatAttachmentsMiddleware,
  validate([
    { field: 'message', required: false, type: 'string' },
    { field: 'language', required: false, type: 'string' },
  ]),
  asyncHandler(chat)
)

export default router
