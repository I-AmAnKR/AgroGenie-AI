/**
 * Voice Controller — Phase 14B.
 *
 * Handles POST /api/v1/voice/transcribe.
 *
 * Flow:
 *   1. Audio arrives as multipart/form-data (field: "audio") via multer.
 *   2. Validate MIME type — only audio/* content is accepted.
 *   3. Validate size — enforced by multer limit but double-checked here.
 *   4. Delegate to the STT provider (mock or IBM real).
 *   5. Run language detection on the transcript (existing Phase A service).
 *   6. Return { transcript, detectedLanguage, confidence, provider, isDemo }.
 *
 * The voice controller does NOT call processChat() or Agent Router.
 * The transcript is returned to the frontend, which injects it into the
 * existing chat input and submits via POST /api/v1/chat.
 * This preserves the full agent routing pipeline without creating a bypass.
 *
 * Security:
 *  - IBM credentials never returned in response.
 *  - Audio bytes live only in req.file.buffer (memory, not disk).
 *  - Buffer is eligible for GC after response is sent.
 *  - Provider errors are mapped to safe error codes — raw IBM errors are not forwarded.
 */
import { getSttProvider } from '../providers/stt.provider.factory.js'
import { detectLanguage } from '../services/language.service.js'
import { success, error } from '../utils/apiResponse.js'
import logger from '../utils/logger.js'
import config from '../config/env.js'

// Accepted audio MIME types.
// IBM STT REST accepts: audio/webm, audio/ogg, audio/wav, audio/flac, audio/mp4, audio/mpeg
const ACCEPTED_MIME_PREFIXES = ['audio/']
const ACCEPTED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/flac',
  'audio/mp4',
  'audio/mpeg',
  'audio/x-m4a',
  'audio/3gpp',
])

// STT error codes that map to specific HTTP status codes
const STT_ERROR_HTTP_MAP = {
  STT_AUTH_ERROR: 502,
  STT_CONFIGURATION_ERROR: 500,
  STT_RATE_LIMIT: 429,
  STT_TIMEOUT: 504,
  STT_PROVIDER_ERROR: 502,
  STT_BAD_REQUEST: 400,
}

/**
 * POST /api/v1/voice/transcribe
 *
 * Expects multipart/form-data with:
 *   audio     — audio file (required)
 *   language  — BCP-47 hint (optional, used for STT model selection)
 */
export async function transcribeVoice(req, res) {
  const requestId = res.locals?.requestId ?? `voice-${Date.now()}`

  // ── 1. Validate file presence ────────────────────────────────────────────
  if (!req.file) {
    return error(res, 'VOICE_NO_AUDIO', 'No audio file received. Send multipart/form-data with field "audio".', 400)
  }

  const { buffer, mimetype, size } = req.file
  const languageHint = req.body?.language ?? 'en'

  // ── 2. Validate MIME type ────────────────────────────────────────────────
  const mimeOk =
    ACCEPTED_MIME_PREFIXES.some((prefix) => mimetype.startsWith(prefix)) &&
    (ACCEPTED_MIME_TYPES.has(mimetype) || mimetype.startsWith('audio/'))

  if (!mimeOk) {
    logger.warn('VoiceController: rejected non-audio MIME type', {
      requestId,
      mimetype,
    })
    return error(
      res,
      'VOICE_INVALID_MIME',
      `Unsupported audio format: ${mimetype}. Supported: audio/webm, audio/ogg, audio/wav, audio/mp4.`,
      415
    )
  }

  // ── 3. Validate file size (belt-and-suspenders after multer limit) ───────
  const maxBytes = config.stt.maxBytes
  if (size > maxBytes) {
    logger.warn('VoiceController: audio file exceeds size limit', {
      requestId,
      size,
      maxBytes,
    })
    return error(
      res,
      'VOICE_TOO_LARGE',
      `Audio file too large (${(size / 1024 / 1024).toFixed(1)} MB). Maximum: ${(maxBytes / 1024 / 1024).toFixed(0)} MB.`,
      413
    )
  }

  logger.debug('VoiceController: transcribing audio', {
    requestId,
    mimetype,
    size,
    languageHint,
  })

  // ── 4. Transcribe via STT provider ───────────────────────────────────────
  let sttResult
  try {
    const sttProvider = getSttProvider()
    sttResult = await sttProvider.transcribe({
      audioBuffer: buffer,
      mimeType: mimetype,
      language: languageHint,
      metadata: { requestId },
    })
  } catch (err) {
    const statusCode = STT_ERROR_HTTP_MAP[err.code] ?? 500
    const code = err.code ?? 'STT_PROVIDER_ERROR'
    const msg = err.message ?? 'Speech to text processing failed.'
    logger.error('VoiceController: STT provider error', {
      requestId,
      code,
      message: msg,
    })
    return error(res, code, msg, statusCode)
  }

  const { transcript, confidence, isDemo, provider, model } = sttResult

  // ── 5. Language detection on transcript ──────────────────────────────────
  // Reuse Phase A language detection on the transcript text.
  // This gives the frontend the detected language so chat can be sent with
  // the correct language parameter (improving LLM response language).
  let detectedLanguage = languageHint
  if (transcript) {
    try {
      const detection = await detectLanguage(transcript, {
        hint: languageHint !== 'en' ? languageHint : null,
        metadata: { requestId },
      })
      detectedLanguage = detection.language
    } catch {
      // Language detection failure is non-fatal — proceed with hint
      detectedLanguage = languageHint
    }
  }

  logger.debug('VoiceController: transcription complete', {
    requestId,
    transcriptLength: transcript.length,
    detectedLanguage,
    confidence,
    provider,
    isDemo,
  })

  // ── 6. Return result ─────────────────────────────────────────────────────
  return success(res, {
    transcript,
    detectedLanguage,
    confidence,
    provider,
    model,
    isDemo,
    // Explicitly exclude: IBM credentials, raw audio, bearer token
  })
}
