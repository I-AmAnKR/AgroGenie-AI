/**
 * Voice Synthesize Controller — Phase 14C.
 *
 * Handles POST /api/v1/voice/synthesize.
 *
 * Flow:
 *   1. Validate text (required, non-empty, within size limit).
 *   2. Delegate to TTS provider (mock or IBM real).
 *   3. Stream audio bytes back to client as audio/ogg or audio/mp3.
 *
 * Design rules:
 *  - Text response always remains available — TTS is additive only.
 *  - Audio is NEVER automatically synthesized for every message.
 *    This endpoint is only called when the user explicitly presses Play.
 *  - Structured data (prices, scores) is stripped before synthesis via
 *    the extractSpeakableText() helper — numbers remain as ASCII digits.
 *  - IBM credentials are NEVER returned in the response.
 *  - Audio bytes are streamed directly — never written to disk or COS.
 *
 * Response:
 *   Content-Type: audio/ogg  (or audio/mp3 if provider returns mp3)
 *   Body: raw audio bytes
 *
 *   On error: JSON { success: false, code, message }
 */
import { getTtsProvider } from '../providers/tts.provider.factory.js'
import { success, error } from '../utils/apiResponse.js'
import logger from '../utils/logger.js'
import config from '../config/env.js'

// TTS error codes → HTTP status
const TTS_ERROR_HTTP_MAP = {
  TTS_AUTH_ERROR: 502,
  TTS_CONFIGURATION_ERROR: 500,
  TTS_RATE_LIMIT: 429,
  TTS_TIMEOUT: 504,
  TTS_PROVIDER_ERROR: 502,
  TTS_BAD_REQUEST: 400,
  TTS_INVALID_INPUT: 400,
  TTS_VOICE_NOT_FOUND: 400,
}

// Maximum text accepted by this endpoint (before IBM-level truncation)
const MAX_TEXT_CHARS = 3000

/**
 * POST /api/v1/voice/synthesize
 *
 * Body (JSON):
 *   text      {string}  — text to synthesize (required)
 *   language  {string}  — BCP-47 hint (optional, default 'en')
 *   voice     {string}  — IBM voice override (optional)
 */
export async function synthesizeVoice(req, res) {
  const requestId = res.locals?.requestId ?? `tts-${Date.now()}`
  const { text, language = 'en', voice } = req.body ?? {}

  // ── 1. Input validation ──────────────────────────────────────────────────
  if (!text || typeof text !== 'string' || !text.trim()) {
    return error(res, 'TTS_INVALID_INPUT', 'text field is required and must be a non-empty string.', 400)
  }

  const trimmed = text.trim()

  if (trimmed.length > MAX_TEXT_CHARS) {
    return error(
      res,
      'TTS_TEXT_TOO_LONG',
      `Text exceeds maximum of ${MAX_TEXT_CHARS} characters. Send a shorter excerpt.`,
      413
    )
  }

  // Strip structured data noise from text before speaking
  const speakable = extractSpeakableText(trimmed)

  if (!speakable) {
    return error(res, 'TTS_INVALID_INPUT', 'No speakable content found in text.', 400)
  }

  logger.debug('SynthesizeVoice: synthesis requested', {
    requestId,
    language,
    textLength: speakable.length,
    hasVoiceOverride: !!voice,
  })

  // ── 2. Synthesize via TTS provider ───────────────────────────────────────
  let ttsResult
  try {
    const ttsProvider = getTtsProvider()
    ttsResult = await ttsProvider.synthesize({
      text: speakable,
      language,
      voice,
      metadata: { requestId },
    })
  } catch (err) {
    const statusCode = TTS_ERROR_HTTP_MAP[err.code] ?? 500
    const code = err.code ?? 'TTS_PROVIDER_ERROR'
    const msg = err.message ?? 'Text to speech processing failed.'
    logger.error('SynthesizeVoice: TTS provider error', { requestId, code, message: msg })
    return error(res, code, msg, statusCode)
  }

  const { audioBuffer, mimeType, voice: usedVoice, provider, isDemo } = ttsResult

  // ── 3. Stream audio to client ────────────────────────────────────────────
  // Return audio as binary stream — client uses Web Audio API / <audio> element
  res.set({
    'Content-Type': mimeType,
    'Content-Length': audioBuffer.length,
    'X-TTS-Provider': provider,
    'X-TTS-Voice': usedVoice,
    'X-TTS-Demo': String(isDemo),
    // Prevent caching of synthesized audio (content may change with model updates)
    'Cache-Control': 'no-store',
  })

  logger.debug('SynthesizeVoice: streaming audio', {
    requestId,
    audioBytes: audioBuffer.length,
    mimeType,
    provider,
    isDemo,
  })

  res.status(200).end(audioBuffer)
}

/**
 * POST /api/v1/voice/tts-ready
 *
 * Lightweight readiness check — tells the frontend whether TTS is available
 * without requiring the client to attempt a synthesis call.
 *
 * Response: { available: bool, provider: string, isDemo: bool }
 */
export async function ttsReadiness(req, res) {
  try {
    const provider = getTtsProvider()
    const status = provider.getHealthStatus()
    // Infer isDemo from the provider's health status (makes tests robust against env)
    const isDemo = status === 'mock'

    return success(res, {
      available: true,
      provider: isDemo ? 'mock' : 'ibm-tts',
      isDemo,
      status,
    })
  } catch (err) {
    // TTS_CONFIGURATION_ERROR in real mode — credentials not yet set
    if (err.code === 'TTS_CONFIGURATION_ERROR') {
      return success(res, {
        available: false,
        provider: 'none',
        isDemo: false,
        status: 'not-configured',
        reason: 'IBM_TTS_API_KEY not configured.',
      })
    }
    return error(res, err.code ?? 'TTS_ERROR', err.message, 500)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract speakable plain text from an agent response.
 *
 * Removes:
 *  - Markdown formatting (**bold**, #headers, ---rules)
 *  - JSON-looking fragments {{ ... }}
 *  - Source references [1], [2]
 *  - Long numeric sequences (prices, coordinates) — keep short numbers
 *  - Excessive whitespace
 *
 * Preserves:
 *  - Sentences and paragraph structure
 *  - Short numbers (crop scores, percentages, years)
 *  - Agricultural terms
 *
 * @param {string} text
 * @returns {string}
 */
export function extractSpeakableText(text) {
  return text
    .replace(/#{1,6}\s+/g, '')           // remove markdown headers
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // bold → plain
    .replace(/\*([^*]+)\*/g, '$1')       // italic → plain
    .replace(/---+/g, '')                // horizontal rules
    .replace(/\[(\d+)\]/g, '')           // source citations [1]
    .replace(/\{\{[^}]*\}\}/g, '')       // template fragments
    .replace(/https?:\/\/\S+/g, '')      // strip URLs (unreadable aloud)
    .replace(/\s{2,}/g, ' ')            // collapse whitespace
    .trim()
}
