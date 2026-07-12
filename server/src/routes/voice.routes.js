/**
 * Voice routes — Phase 14B + 14C.
 *
 * POST /api/v1/voice/transcribe
 *   Accepts audio file (multipart/form-data, field: "audio").
 *   Returns { transcript, detectedLanguage, confidence, provider, isDemo }.
 *
 * POST /api/v1/voice/synthesize  [Phase 14C]
 *   Accepts JSON { text, language, voice }.
 *   Returns raw audio bytes (audio/ogg) as a binary stream.
 *   Only called on explicit user action (Play button) — never auto-triggered.
 *
 * GET /api/v1/voice/tts-ready  [Phase 14C]
 *   Lightweight TTS availability check.
 *   Returns { available: bool, provider, isDemo, status }.
 *
 * Audio never persists to disk or COS.
 */
import { Router } from 'express'
import multer from 'multer'
import { asyncHandler } from '../utils/asyncHandler.js'
import { transcribeVoice } from '../controllers/voice.controller.js'
import { synthesizeVoice, ttsReadiness } from '../controllers/voice.synthesize.controller.js'
import config from '../config/env.js'

const router = Router()

// Memory storage — audio bytes live in req.file.buffer only.
// The buffer is released after the response is sent (no disk I/O).
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.stt.maxBytes, // default 5 MB
    files: 1,                      // one audio file per request
  },
  fileFilter(_req, file, cb) {
    // Allow any audio/* MIME type — controller does stricter validation
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true)
    } else {
      // Reject non-audio at multer level before the buffer is allocated
      const err = new Error(`File type "${file.mimetype}" is not accepted. Only audio files are allowed.`)
      err.code = 'VOICE_INVALID_MIME'
      err.statusCode = 415
      cb(err, false)
    }
  },
})

/**
 * Multer error handler — converts multer-specific errors to the
 * standard apiResponse format before they reach the global error handler.
 */
function handleMulterError(err, _req, res, next) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    const maxMB = (config.stt.maxBytes / 1024 / 1024).toFixed(0)
    return res.status(413).json({
      success: false,
      code: 'VOICE_TOO_LARGE',
      message: `Audio file exceeds the ${maxMB} MB limit.`,
    })
  }
  if (err.code === 'VOICE_INVALID_MIME') {
    return res.status(415).json({
      success: false,
      code: 'VOICE_INVALID_MIME',
      message: err.message,
    })
  }
  next(err)
}

// POST /api/v1/voice/transcribe
router.post(
  '/transcribe',
  audioUpload.single('audio'),
  handleMulterError,
  asyncHandler(transcribeVoice)
)

// POST /api/v1/voice/synthesize [Phase 14C]
// JSON body: { text, language?, voice? }
// Returns: raw audio bytes (audio/ogg)
// Only invoked by explicit user action (Play button) — never auto-triggered.
router.post('/synthesize', asyncHandler(synthesizeVoice))

// GET /api/v1/voice/tts-ready [Phase 14C]
// Lightweight TTS availability probe — called once on Chat page mount.
router.get('/tts-ready', asyncHandler(ttsReadiness))

export default router

