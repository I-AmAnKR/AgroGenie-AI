/**
 * IBM Cloud Text to Speech provider — Phase 14C.
 *
 * Implements the TTS provider interface against the IBM Cloud Text to Speech
 * REST API using native Node.js fetch (Node ≥ 18) or https module fallback.
 *
 * No new npm dependency — same fetch-or-https pattern as stt.provider.js.
 *
 * Authentication: IBM IAM API key → bearer token exchange.
 * Bearer tokens are cached for 50 minutes (IBM tokens expire at 60 min).
 * The TTS provider maintains its OWN separate token cache from STT.
 *
 * Credential safety:
 *  - IBM_TTS_API_KEY is NEVER logged.
 *  - Bearer token is NEVER logged.
 *  - Raw IBM error bodies are sanitized before being thrown.
 *
 * Interface:
 *   synthesize({ text, language, voice, metadata })
 *   → { audioBuffer, mimeType, voice, provider, isDemo }
 *
 * IBM TTS REST API docs:
 *   https://cloud.ibm.com/apidocs/text-to-speech#synthesize
 *
 * IBM voices used:
 *   en-US_AllisonV3Voice  — English (US), female, neural
 *   hi-IN_EelaVoice       — Hindi (India), female, neural (if available)
 *   Fallback:             — en-US_AllisonV3Voice for unsupported languages
 */
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── IAM token cache (separate from STT cache) ─────────────────────────────────

const _ttsTokenCache = {
  token: null,
  expiresAt: 0,
}

const TOKEN_EXPIRY_BUFFER_MS = 10 * 60 * 1000 // 10 min safety margin

/**
 * Exchange IBM_TTS_API_KEY for a bearer token via IBM IAM.
 * Caches the token for 50 minutes.
 * @returns {Promise<string>} Bearer token
 * @throws {Error} TTS_AUTH_ERROR on IAM failure
 */
async function getBearerToken() {
  const now = Date.now()
  if (_ttsTokenCache.token && now < _ttsTokenCache.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return _ttsTokenCache.token
  }

  const { apiKey, iamUrl } = config.tts
  const fetchFn = typeof fetch !== 'undefined' ? fetch : await _getFallbackFetch()

  const body = new URLSearchParams({
    grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
    apikey: apiKey,
  })

  let response
  try {
    response = await fetchFn(iamUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (err) {
    logger.error('IbmTtsProvider: IAM token request failed (network)', {
      iamUrl,
      message: err.message,
    })
    const e = new Error('IBM TTS authentication failed — network error reaching IAM endpoint.')
    e.code = 'TTS_AUTH_ERROR'
    e.statusCode = 502
    throw e
  }

  if (!response.ok) {
    const status = response.status
    logger.error('IbmTtsProvider: IAM token exchange rejected', { status, iamUrl })
    const e = new Error(`IBM TTS authentication failed — IAM returned HTTP ${status}.`)
    e.code = 'TTS_AUTH_ERROR'
    e.statusCode = 502
    throw e
  }

  let data
  try {
    data = await response.json()
  } catch {
    const e = new Error('IBM TTS authentication failed — IAM response was not valid JSON.')
    e.code = 'TTS_AUTH_ERROR'
    e.statusCode = 502
    throw e
  }

  if (!data.access_token) {
    const e = new Error('IBM TTS authentication failed — IAM response missing access_token.')
    e.code = 'TTS_AUTH_ERROR'
    e.statusCode = 502
    throw e
  }

  _ttsTokenCache.token = data.access_token
  _ttsTokenCache.expiresAt = now + 50 * 60 * 1000

  logger.debug('IbmTtsProvider: IAM token refreshed', { expiresIn: '50 min' })
  return _ttsTokenCache.token
}

/**
 * Fallback fetch for Node.js < 18. Loaded dynamically only if needed.
 */
async function _getFallbackFetch() {
  const https = await import('node:https')
  const { URL } = await import('node:url')

  return function fetchViaHttps(url, options = {}) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url)
      const bodyStr = options.body?.toString() ?? ''
      const reqOptions = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: options.method ?? 'GET',
        headers: {
          ...options.headers,
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      }
      const req = https.request(reqOptions, (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks)
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: () => Promise.resolve(JSON.parse(rawBody.toString())),
            arrayBuffer: () => Promise.resolve(rawBody.buffer.slice(rawBody.byteOffset, rawBody.byteOffset + rawBody.byteLength)),
          })
        })
      })
      req.on('error', reject)
      if (bodyStr) req.write(bodyStr)
      req.end()
    })
  }
}

// ── Voice selection ────────────────────────────────────────────────────────────

/**
 * IBM TTS voice identifiers (verified from IBM docs).
 * Neural V3 voices produce the most natural output.
 *
 * Language → voice mapping:
 *   en        → en-US_AllisonV3Voice
 *   hi        → hi-IN_EelaVoice  (IBM neural Hindi, if provisioned; else broadband fallback)
 *   hi-Latn   → en-US_AllisonV3Voice (Hinglish spoken via English voice)
 *   pa        → en-US_AllisonV3Voice (no IBM Punjabi TTS voice available)
 *
 * Note: Availability of hi-IN_EelaVoice depends on the IBM Cloud TTS service plan.
 * If your plan does not include it, set IBM_TTS_VOICE_HI=en-US_AllisonV3Voice.
 */
const VOICE_MAP = {
  en: 'en-US_AllisonV3Voice',
  'hi-Latn': 'en-US_AllisonV3Voice',
  pa: 'en-US_AllisonV3Voice',
  hi: 'hi-IN_EelaVoice',
}

function voiceForLanguage(language) {
  // Allow env override for any language
  const override = config.tts[`voice_${language?.replace('-', '_')}`]
  if (override) return override
  return VOICE_MAP[language] ?? config.tts.defaultVoice
}

// ── Provider object ────────────────────────────────────────────────────────────

export const ibmTtsProvider = {
  /**
   * Synthesize text to speech audio using IBM Cloud TTS REST API.
   *
   * @param {object} options
   * @param {string}  options.text       - Plain text to synthesize (max 5KB per IBM limit)
   * @param {string}  [options.language] - BCP-47 language code for voice selection
   * @param {string}  [options.voice]    - Override IBM voice identifier
   * @param {object}  [options.metadata] - Request metadata for logging
   * @returns {Promise<{audioBuffer: Buffer, mimeType: string, voice: string, provider: string, isDemo: boolean}>}
   * @throws {Error} TTS_AUTH_ERROR | TTS_PROVIDER_ERROR | TTS_TIMEOUT | TTS_TEXT_TOO_LONG
   */
  async synthesize({ text, language = 'en', voice: voiceOverride, metadata = {} }) {
    const requestId = metadata.requestId ?? 'unknown'

    if (!text?.trim()) {
      const e = new Error('TTS requires non-empty text.')
      e.code = 'TTS_INVALID_INPUT'
      e.statusCode = 400
      throw e
    }

    // IBM TTS REST limit: 5 KB for plain text
    const TEXT_LIMIT_BYTES = 5000
    if (Buffer.byteLength(text, 'utf8') > TEXT_LIMIT_BYTES) {
      logger.warn('IbmTtsProvider: text exceeds IBM limit — truncating', {
        requestId,
        originalBytes: Buffer.byteLength(text, 'utf8'),
        limitBytes: TEXT_LIMIT_BYTES,
      })
      // Truncate to nearest sentence boundary under the limit
      text = _truncateToLimit(text, TEXT_LIMIT_BYTES)
    }

    const selectedVoice = voiceOverride ?? voiceForLanguage(language)
    const outputFormat = 'audio/ogg;codecs=opus' // broad browser support, good compression

    logger.debug('IbmTtsProvider: synthesizing', {
      requestId,
      language,
      voice: selectedVoice,
      textLength: text.length,
    })

    const token = await getBearerToken()
    const { serviceUrl } = config.tts
    const fetchFn = typeof fetch !== 'undefined' ? fetch : await _getFallbackFetch()

    const synthesizeUrl = `${serviceUrl}/v1/synthesize?voice=${encodeURIComponent(selectedVoice)}`

    let response
    try {
      response = await fetchFn(synthesizeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: outputFormat,
        },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (err) {
      if (err.name === 'TimeoutError' || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
        const e = new Error('IBM TTS request timed out after 30 seconds.')
        e.code = 'TTS_TIMEOUT'
        e.statusCode = 504
        throw e
      }
      logger.error('IbmTtsProvider: synthesis network error', { requestId, message: err.message })
      const e = new Error('IBM TTS request failed — network error.')
      e.code = 'TTS_PROVIDER_ERROR'
      e.statusCode = 502
      throw e
    }

    if (!response.ok) {
      const status = response.status
      logger.error('IbmTtsProvider: synthesis HTTP error', { requestId, status, voice: selectedVoice })
      const errorMap = {
        400: { msg: 'IBM TTS rejected the request (bad input — check voice/text).', code: 'TTS_BAD_REQUEST', http: 400 },
        401: { msg: 'IBM TTS authentication failed — check IBM_TTS_API_KEY.', code: 'TTS_AUTH_ERROR', http: 502 },
        403: { msg: 'IBM TTS API key does not have Text to Speech access.', code: 'TTS_AUTH_ERROR', http: 502 },
        404: { msg: `IBM TTS voice '${selectedVoice}' not found — check IBM_TTS_VOICE_* config.`, code: 'TTS_VOICE_NOT_FOUND', http: 400 },
        429: { msg: 'IBM TTS rate limit exceeded — retry later.', code: 'TTS_RATE_LIMIT', http: 429 },
      }
      const mapped = errorMap[status] ?? { msg: `IBM TTS error HTTP ${status}.`, code: 'TTS_PROVIDER_ERROR', http: 502 }
      const e = new Error(mapped.msg)
      e.code = mapped.code
      e.statusCode = mapped.http
      if (status === 401 || status === 403) {
        _ttsTokenCache.token = null
        _ttsTokenCache.expiresAt = 0
      }
      throw e
    }

    // Read audio bytes from response
    let audioBuffer
    try {
      const arrayBuf = await response.arrayBuffer()
      audioBuffer = Buffer.from(arrayBuf)
    } catch {
      const e = new Error('IBM TTS returned an unreadable audio response.')
      e.code = 'TTS_PROVIDER_ERROR'
      e.statusCode = 502
      throw e
    }

    if (!audioBuffer.length) {
      const e = new Error('IBM TTS returned empty audio.')
      e.code = 'TTS_PROVIDER_ERROR'
      e.statusCode = 502
      throw e
    }

    logger.debug('IbmTtsProvider: synthesis complete', {
      requestId,
      voice: selectedVoice,
      audioBytes: audioBuffer.length,
    })

    return {
      audioBuffer,
      mimeType: 'audio/ogg',
      voice: selectedVoice,
      provider: 'ibm-tts',
      isDemo: false,
    }
  },

  /**
   * Return the TTS health status without a live API call.
   * @returns {'connected'|'not-configured'}
   */
  getHealthStatus() {
    const { apiKey, serviceUrl } = config.tts
    if (!apiKey || !serviceUrl) return 'not-configured'
    return 'connected'
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Truncate text to fit within IBM TTS byte limit.
 * Tries to cut at sentence boundaries (. ! ?) to avoid mid-word truncation.
 * @param {string} text
 * @param {number} limitBytes
 * @returns {string}
 */
function _truncateToLimit(text, limitBytes) {
  // Walk backwards from the limit to find a sentence boundary
  let encoded = Buffer.from(text, 'utf8')
  if (encoded.length <= limitBytes) return text

  const truncated = encoded.slice(0, limitBytes).toString('utf8')
  // Find last sentence-ending punctuation
  const lastSentence = truncated.search(/[.!?][^.!?]*$/)
  if (lastSentence > limitBytes * 0.5) {
    return truncated.slice(0, lastSentence + 1).trim()
  }
  // Fallback: cut at last space
  const lastSpace = truncated.lastIndexOf(' ')
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim() + '...'
}
