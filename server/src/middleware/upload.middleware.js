import multer from 'multer'
import config from '../config/env.js'

/**
 * Phase 17A: Configure multer for image uploads (in-memory storage).
 *
 * Allowed MIME types and file-size limits are controlled entirely via env vars
 * (IMAGE_ALLOWED_TYPES, MAX_IMAGE_BYTES) so no code changes are needed to adjust
 * them in different environments.
 */

// Parse comma-separated allowed types from config, falling back to safe defaults
const ALLOWED_TYPES = config.image.allowedTypes
  ? config.image.allowedTypes.split(',').map(t => t.trim()).filter(Boolean)
  : ['image/jpeg', 'image/png', 'image/webp']

const MAX_BYTES = config.image.maxBytes || 5 * 1024 * 1024

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      const err = new Error(
        `Unsupported image type: ${file.mimetype}. Allowed: ${ALLOWED_TYPES.join(', ')}.`
      )
      err.code = 'UNSUPPORTED_FILE_TYPE'
      err.statusCode = 415
      cb(err)
    }
  },
})

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      const err = new Error(
        `Unsupported attachment type: ${file.mimetype}. Allowed: ${ALLOWED_TYPES.join(', ')}.`
      )
      err.code = 'UNSUPPORTED_FILE_TYPE'
      err.statusCode = 415
      cb(err)
    }
  },
})

/**
 * Multer error handler — translates multer errors into the standard API error shape.
 */
function handleMulterError(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMb = (MAX_BYTES / 1024 / 1024).toFixed(1)
      return res.status(413).json({
        success: false,
        data: null,
        error: { code: 'UPLOAD_TOO_LARGE', message: `File exceeds maximum allowed size of ${maxMb} MB.`, details: [] },
        meta: { requestId: res.locals.requestId ?? null },
      })
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'TOO_MANY_FILES', message: 'Maximum of 5 attachments allowed.', details: [] },
        meta: { requestId: res.locals.requestId ?? null },
      })
    }
    return res.status(400).json({
      success: false,
      data: null,
      error: { code: 'UPLOAD_ERROR', message: err.message, details: [] },
      meta: { requestId: res.locals.requestId ?? null },
    })
  }
  if (err?.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(415).json({
      success: false,
      data: null,
      error: { code: err.code, message: err.message, details: [] },
      meta: { requestId: res.locals.requestId ?? null },
    })
  }
  next(err)
}

export const uploadImageMiddleware = [
  imageUpload.single('image'),
  handleMulterError,
]

export const uploadChatAttachmentsMiddleware = [
  chatUpload.array('attachments', 5),
  handleMulterError,
]
