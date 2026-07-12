/**
 * watsonx.ai provider (model-agnostic — Llama, Granite, Mistral, etc.).
 *
 * Implements the normalized AI provider interface:
 *   generate({ messages, systemPrompt, parameters, metadata })
 *   → { content, model, provider, usage, finishReason, isDemo }
 *
 * Uses @ibm-cloud/watsonx-ai SDK with IAM authentication.
 * The SDK client is created once (singleton) and reused across requests.
 *
 * Credential safety rules:
 * - API key, IAM token, and authorization headers are NEVER logged.
 * - SDK errors are mapped to safe application error codes before propagating.
 * - Raw SDK error objects are never returned to the frontend.
 */
import { WatsonXAI } from '@ibm-cloud/watsonx-ai'
import { IamAuthenticator } from '@ibm-cloud/watsonx-ai/authentication/index.mjs'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── Singleton client ────────────────────────────────────────────────────────

let _client = null

/**
 * Build and return the watsonx.ai SDK client (singleton).
 * Throws AI_CONFIGURATION_ERROR if required credentials are absent.
 */
function getClient() {
  if (_client) return _client

  const { apiKey, url, projectId } = config.watsonx

  if (!apiKey) {
    const err = new Error(
      'WATSONX_API_KEY is not configured. Add it to server/.env.'
    )
    err.code = 'AI_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }
  if (!projectId) {
    const err = new Error(
      'WATSONX_PROJECT_ID is not configured. Add it to server/.env.'
    )
    err.code = 'AI_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  _client = new WatsonXAI({
    serviceUrl: url,
    authenticator: new IamAuthenticator({ apikey: apiKey }),
    version: '2024-05-31',
  })

  // Log initialization but NEVER log apiKey or projectId values
  logger.info('watsonx.ai client initialized', {
    serviceUrl: url,
    modelId: config.watsonx.modelId,
  })

  return _client
}

// ── Default generation parameters ─────────────────────────────────────────

/**
 * Conservative defaults suitable for agricultural assistance.
 * - Low temperature for factual responses.
 * - Reasonable output limit to avoid runaway generation.
 *
 * The watsonx.ai textChat SDK requires camelCase top-level params:
 *   maxTokens, temperature, topP  (NOT nested under a `parameters:` key)
 * Callers pass snake_case { max_tokens, top_p } which we map here.
 */
const DEFAULT_PARAMETERS = {
  maxTokens: 800,
  temperature: 0.3,
  topP: 0.85,
}

/**
 * Map caller-supplied snake_case overrides to SDK camelCase keys.
 * Unrecognised keys are passed through as-is (for forward compatibility).
 *
 * @param {object} overrides - Caller-provided parameter overrides
 * @returns {object} camelCase SDK parameters
 */
function mapParams(overrides) {
  const mapped = {}
  for (const [k, v] of Object.entries(overrides)) {
    if (k === 'max_tokens')  { mapped.maxTokens  = v; continue }
    if (k === 'max_new_tokens') { mapped.maxTokens = v; continue }
    if (k === 'top_p')       { mapped.topP       = v; continue }
    if (k === 'repetition_penalty') continue // not supported for chat models
    mapped[k] = v
  }
  return mapped
}

// ── Error mapping ───────────────────────────────────────────────────────────

/**
 * Map SDK error to a safe application error.
 * Never expose raw SDK internals, credentials, or token information.
 *
 * @param {Error} err - Raw SDK/network error
 * @returns {Error} Application-level error with .code and .statusCode
 */
function mapSdkError(err) {
  const status = err.status ?? err.statusCode ?? 0
  const message = err.message ?? ''

  const appErr = new Error()
  // Preserve stack for dev-mode logging only
  appErr.stack = err.stack

  if (status === 401 || message.includes('Unauthorized') || message.includes('401')) {
    appErr.code = 'AI_AUTH_ERROR'
    appErr.statusCode = 502
    appErr.message = 'AI provider authentication failed. Verify WATSONX_API_KEY.'
    return appErr
  }
  if (status === 403 || message.includes('Forbidden') || message.includes('403')) {
    appErr.code = 'AI_AUTH_ERROR'
    appErr.statusCode = 502
    appErr.message = 'AI provider access denied. Verify WATSONX_PROJECT_ID and IAM permissions.'
    return appErr
  }
  if (
    status === 404 ||
    message.toLowerCase().includes('model not found') ||
    message.toLowerCase().includes('unknown model')
  ) {
    appErr.code = 'AI_CONFIGURATION_ERROR'
    appErr.statusCode = 502
    appErr.message = 'AI model not found. Verify MODEL_ID in .env.'
    return appErr
  }
  if (status === 429 || message.toLowerCase().includes('rate limit') || message.toLowerCase().includes('quota')) {
    appErr.code = 'AI_RATE_LIMIT'
    appErr.statusCode = 429
    appErr.message = 'AI provider rate limit reached. Please wait and try again.'
    return appErr
  }
  if (
    message.toLowerCase().includes('timeout') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ECONNABORTED') ||
    status === 408
  ) {
    appErr.code = 'AI_TIMEOUT'
    appErr.statusCode = 504
    appErr.message = 'AI provider request timed out.'
    return appErr
  }
  if (status >= 500 || message.toLowerCase().includes('service unavailable')) {
    appErr.code = 'AI_PROVIDER_ERROR'
    appErr.statusCode = 502
    appErr.message = 'AI provider is temporarily unavailable.'
    return appErr
  }

  appErr.code = 'AI_PROVIDER_ERROR'
  appErr.statusCode = 502
  appErr.message = 'An unexpected error occurred with the AI provider.'
  return appErr
}

// ── Provider ────────────────────────────────────────────────────────────────

export const watsonxProvider = {
  /**
   * Generate a response via watsonx.ai textChat API (model-agnostic).
   *
   * @param {object} options
   * @param {Array<{role: string, content: string}>} options.messages
   *   Conversation history in user/assistant turn format.
   * @param {string} [options.systemPrompt]
   *   System instruction prepended to the message array.
   * @param {object} [options.parameters={}]
   *   Optional generation parameter overrides (merged with defaults).
   * @param {object} [options.metadata={}]
   *   Optional metadata used for structured logging (requestId, etc.).
   * @returns {Promise<{content, model, provider, usage, finishReason, isDemo}>}
   */
  async generate({ messages, systemPrompt, parameters = {}, metadata = {} }) {
    const client = getClient()
    const { projectId, modelId } = config.watsonx

    // Compose final message array: system first, then conversation history
    const sdkMessages = []
    if (systemPrompt) {
      sdkMessages.push({ role: 'system', content: systemPrompt })
    }
    for (const msg of messages) {
      sdkMessages.push({ role: msg.role, content: msg.content })
    }

    // Merge defaults with caller overrides, mapping snake_case → camelCase
    const mergedParams = { ...DEFAULT_PARAMETERS, ...mapParams(parameters) }

    logger.debug('watsonx.ai textChat request', {
      requestId: metadata.requestId,
      modelId,
      messageCount: sdkMessages.length,
      maxTokens: mergedParams.maxTokens,
      // Never log projectId or apiKey
    })

    let response
    try {
      // textChat params are top-level camelCase — NOT nested under `parameters:`
      response = await client.textChat({
        modelId,
        projectId,
        messages: sdkMessages,
        ...mergedParams,
      })
    } catch (err) {
      logger.error('watsonx.ai textChat error', {
        requestId: metadata.requestId,
        provider: 'watsonx',
        // Log safe status info only — never log credentials or token details
        httpStatus: err.status ?? err.statusCode ?? 'N/A',
      })
      throw mapSdkError(err)
    }

    // Validate and normalize the SDK response
    const result = response?.result
    if (!result || !Array.isArray(result.choices) || result.choices.length === 0) {
      const err = new Error('AI provider returned an unexpected or empty response.')
      err.code = 'AI_RESPONSE_ERROR'
      err.statusCode = 502
      throw err
    }

    const choice = result.choices[0]
    const content = choice.message?.content ?? ''
    const finishReason = choice.finish_reason ?? null

    // Populate usage only from real SDK data — do not invent token counts
    const sdkUsage = result.usage
    const usage = {
      inputTokens: sdkUsage?.prompt_tokens ?? null,
      outputTokens: sdkUsage?.completion_tokens ?? null,
    }

    logger.debug('watsonx.ai textChat success', {
      requestId: metadata.requestId,
      outputTokens: usage.outputTokens,
      finishReason,
    })

    return {
      content,
      model: result.model ?? modelId,
      provider: 'watsonx',
      usage,
      finishReason,
      isDemo: false,
    }
  },

  /**
   * Lightweight health check — validates configuration without making an API call.
   * Returns a safe status string.
   *
   * @returns {'connected'|'not-configured'|'error'}
   */
  getHealthStatus() {
    try {
      const { apiKey, projectId } = config.watsonx
      if (!apiKey || !projectId) return 'not-configured'
      // Constructing the client validates auth setup; no network call is made here
      getClient()
      return 'connected'
    } catch {
      return 'error'
    }
  },
}
