/**
 * IBM Cloud Speech to Text provider — Phase 14B.
 *
 * Implements the STT provider interface against the IBM Cloud Speech to Text
 * REST API using native Node.js https/fetch.
 *
 * No new npm dependency: uses Node.js built-in `fetch` (Node ≥ 18) or falls
 * back to `https` module for compatibility with Node 16.
 *
 * Authentication: IBM IAM API key → bearer token exchange.
 * Bearer tokens are cached for 50 minutes (IBM tokens expire at 60 min).
 *
 * Credential safety:
 *  - IBM_STT_API_KEY is NEVER logged.
 *  - Bearer token is NEVER logged.
 *  - Raw HTTP error bodies are sanitized before being thrown.
 *
 * Interface:
 *   transcribe({ audioBuffer, mimeType, language, metadata })
 *   → { transcript, language, confidence, isDemo, provider, model }
 *
 * IBM STT REST API docs:
 *   https://cloud.ibm.com/apidocs/speech-to-text#recognize
 *
 * IBM IAM docs:
 *   https://cloud.ibm.com/docs/account?topic=account-iamtoken_from_apikey
 */
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── IAM token cache ───────────────────────────────────────────────────────────

const _tokenCache = {
  token: null,
  expiresAt: 0, // Unix timestamp in ms
}

const TOKEN_EXPIRY_BUFFER_MS = 10 * 60 * 1000 // 10 min safety margin

/**
 * Exchange the IBM API key for a bearer token.
 * Caches the token for 50 minutes (token lifetime is 60 min).
 *
 * @returns {Promise<string>} Bearer token
 * @throws {Error} STT_AUTH_ERROR on IAM failure
 */
async function getBearerToken() {
  const now = Date.now()
  if (_tokenCache.token && now < _tokenCache.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return _tokenCache.token
  }

  const { apiKey, iamUrl } = config.stt

  // Use built-in fetch (Node 18+). For Node 16 compatibility, use https module.
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
    logger.error('IbmSttProvider: IAM token request failed (network)', {
      iamUrl,
      message: err.message,
      // NEVER log apiKey
    })
    const e = new Error('IBM STT authentication failed — network error reaching IAM endpoint.')
    e.code = 'STT_AUTH_ERROR'
    e.statusCode = 502
    throw e
  }

  if (!response.ok) {
    const status = response.status
    logger.error('IbmSttProvider: IAM token exchange rejected', {
      status,
      iamUrl,
      // NEVER log body or apiKey — may contain sensitive data
    })
    const e = new Error(`IBM STT authentication failed — IAM returned HTTP ${status}.`)
    e.code = 'STT_AUTH_ERROR'
    e.statusCode = 502
    throw e
  }

  let data
  try {
    data = await response.json()
  } catch {
    const e = new Error('IBM STT authentication failed — IAM response was not valid JSON.')
    e.code = 'STT_AUTH_ERROR'
    e.statusCode = 502
    throw e
  }

  if (!data.access_token) {
    const e = new Error('IBM STT authentication failed — IAM response missing access_token.')
    e.code = 'STT_AUTH_ERROR'
    e.statusCode = 502
    throw e
  }

  // Cache token — IBM tokens expire in 3600 s (1 hour). We cache for 50 min.
  _tokenCache.token = data.access_token
  _tokenCache.expiresAt = now + 50 * 60 * 1000

  logger.debug('IbmSttProvider: IAM token refreshed', {
    expiresIn: '50 min (cached)',
    // NEVER log token value
  })

  return _tokenCache.token
}

/**
 * Fallback fetch for Node.js < 18 using https module.
 * Only invoked if global fetch is unavailable.
 * @returns {Function} fetch-compatible function
 */
async function _getFallbackFetch() {
  // Dynamic import so the https module is only loaded if needed
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
          const rawBody = Buffer.concat(chunks).toString()
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: () => Promise.resolve(JSON.parse(rawBody)),
            arrayBuffer: () => Promise.resolve(Buffer.concat(chunks).buffer),
          })
        })
      })
      req.on('error', reject)
      if (bodyStr) req.write(bodyStr)
      req.end()
    })
  }
}

// ── STT API call ─────────────────────────────────────────────────────────────

/**
 * Determine the IBM STT model to use based on detected/requested language.
 *
 * IBM STT model names (v1 recognize API):
 *   en-US_BroadbandModel — English (US), 16kHz+
 *   en-GB_BroadbandModel — English (UK), 16kHz+
 *   hi-IN_Telephony      — Hindi (India), 8kHz telephone
 *
 * Notes:
 *  - There is no dedicated Hinglish (hi-Latn) model.
 *    en-US_BroadbandModel handles Roman-script Hindi acceptably.
 *  - Punjabi (pa) has no IBM STT model — falls back to en-US.
 *  - Model IDs verified from IBM docs as of 2024.
 *
 * @param {string} language - BCP-47 code
 * @returns {string} IBM STT model identifier
 */
function modelForLanguage(language) {
  if (language === 'hi') return 'hi-IN_Telephony'
  // hi-Latn (Hinglish) and pa use English broadband — closest available
  return config.stt.defaultModel // 'en-US_BroadbandModel' by default
}

// ── Provider object ───────────────────────────────────────────────────────────

export const ibmSttProvider = {
  /**
   * Transcribe audio using IBM Cloud Speech to Text REST API.
   *
   * @param {object} options
   * @param {Buffer}  options.audioBuffer - Raw audio bytes
   * @param {string}  options.mimeType    - MIME type (audio/webm, audio/wav, etc.)
   * @param {string}  [options.language]  - BCP-47 language hint for model selection
   * @param {object}  [options.metadata]  - Request metadata for logging
   * @returns {Promise<{transcript: string, language: string, confidence: number, isDemo: boolean, provider: string, model: string}>}
   * @throws {Error} STT_AUTH_ERROR | STT_PROVIDER_ERROR | STT_TIMEOUT
   */
  async transcribe({ audioBuffer, mimeType, language = 'en', metadata = {} }) {
    const requestId = metadata.requestId ?? 'unknown'
    const model = modelForLanguage(language)

    logger.debug('IbmSttProvider: starting transcription', {
      requestId,
      mimeType,
      language,
      model,
      audioBytes: audioBuffer.length,
    })

    const token = await getBearerToken()
    const { serviceUrl } = config.stt

    const recognizeUrl =
      `${serviceUrl}/v1/recognize` +
      `?model=${encodeURIComponent(model)}` +
      `&smart_formatting=true` +
      `&timestamps=false` +
      `&word_confidence=true`

    const fetchFn = typeof fetch !== 'undefined' ? fetch : await _getFallbackFetch()

    let response
    try {
      response = await fetchFn(recognizeUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': mimeType,
          Accept: 'application/json',
        },
        body: audioBuffer,
        signal: AbortSignal.timeout(30_000), // 30 s timeout for transcription
      })
    } catch (err) {
      if (err.name === 'TimeoutError' || err.code === 'UND_ERR_CONNECT_TIMEOUT') {
        const e = new Error('IBM STT request timed out after 30 seconds.')
        e.code = 'STT_TIMEOUT'
        e.statusCode = 504
        throw e
      }
      logger.error('IbmSttProvider: transcription network error', {
        requestId,
        message: err.message,
      })
      const e = new Error('IBM STT request failed — network error.')
      e.code = 'STT_PROVIDER_ERROR'
      e.statusCode = 502
      throw e
    }

    if (!response.ok) {
      const status = response.status
      logger.error('IbmSttProvider: transcription HTTP error', {
        requestId,
        status,
        model,
      })
      const errorMap = {
        400: { msg: 'IBM STT rejected the audio (bad request — check format/model).', code: 'STT_BAD_REQUEST', http: 400 },
        401: { msg: 'IBM STT authentication failed — check IBM_STT_API_KEY.', code: 'STT_AUTH_ERROR', http: 502 },
        403: { msg: 'IBM STT API key does not have Speech to Text access.', code: 'STT_AUTH_ERROR', http: 502 },
        429: { msg: 'IBM STT rate limit exceeded — retry later.', code: 'STT_RATE_LIMIT', http: 429 },
      }
      const mapped = errorMap[status] ?? { msg: `IBM STT error HTTP ${status}.`, code: 'STT_PROVIDER_ERROR', http: 502 }
      const e = new Error(mapped.msg)
      e.code = mapped.code
      e.statusCode = mapped.http
      // Invalidate cached token on 401/403 so next request re-authenticates
      if (status === 401 || status === 403) {
        _tokenCache.token = null
        _tokenCache.expiresAt = 0
      }
      throw e
    }

    let body
    try {
      body = await response.json()
    } catch {
      const e = new Error('IBM STT returned an unreadable response body.')
      e.code = 'STT_PROVIDER_ERROR'
      e.statusCode = 502
      throw e
    }

    // Parse IBM STT v1 recognize response format:
    // { results: [{ alternatives: [{ transcript, confidence }] }] }
    const results = body?.results ?? []
    if (results.length === 0) {
      logger.warn('IbmSttProvider: no transcription results returned', { requestId })
      return {
        transcript: '',
        language,
        confidence: 0,
        isDemo: false,
        provider: 'ibm-stt',
        model,
      }
    }

    const alternatives = results.flatMap((r) => r.alternatives ?? [])
    const best = alternatives.reduce(
      (top, alt) => (alt.confidence > top.confidence ? alt : top),
      { transcript: '', confidence: 0 }
    )

    // Merge multi-segment transcripts (IBM splits on pauses)
    const fullTranscript = results
      .map((r) => (r.alternatives?.[0]?.transcript ?? '').trim())
      .join(' ')
      .trim()

    logger.debug('IbmSttProvider: transcription complete', {
      requestId,
      model,
      confidence: best.confidence,
      transcriptLength: fullTranscript.length,
    })

    return {
      transcript: fullTranscript,
      language,
      confidence: best.confidence ?? 0,
      isDemo: false,
      provider: 'ibm-stt',
      model,
    }
  },

  /**
   * Return the STT health status without a live API call.
   * @returns {'connected'|'not-configured'}
   */
  getHealthStatus() {
    const { apiKey, serviceUrl } = config.stt
    if (!apiKey || !serviceUrl) return 'not-configured'
    return 'connected'
  },
}
