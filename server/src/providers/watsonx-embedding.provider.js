/**
 * watsonx.ai Embeddings provider — Phase 8.
 *
 * Implements the normalized embedding provider interface:
 *   embed(texts, options)
 *   → { vectors: [{ index, vector }], model, provider, usage }
 *
 * Uses WatsonXAI.embedText() from @ibm-cloud/watsonx-ai SDK.
 * The same SDK client as watsonx.provider.js is re-used (singleton shared
 * via the factory pattern).
 *
 * Credential safety:
 * - API key and project ID are NEVER logged.
 * - SDK errors are mapped to safe application error codes before propagating.
 * - Raw SDK responses are never exposed outside this module boundary.
 */
import { WatsonXAI } from '@ibm-cloud/watsonx-ai'
import { IamAuthenticator } from '@ibm-cloud/watsonx-ai/authentication/index.mjs'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── Singleton client ─────────────────────────────────────────────────────────

let _client = null

/**
 * Build and return the watsonx.ai SDK client (singleton).
 * Shares credential validation pattern with watsonx.provider.js.
 * Throws EMBEDDING_CONFIGURATION_ERROR if required credentials are absent.
 */
function getClient() {
  if (_client) return _client

  const { apiKey, url, projectId } = config.watsonx

  if (!apiKey) {
    const err = new Error('WATSONX_API_KEY is not configured. Add it to server/.env.')
    err.code = 'EMBEDDING_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }
  if (!projectId) {
    const err = new Error('WATSONX_PROJECT_ID is not configured. Add it to server/.env.')
    err.code = 'EMBEDDING_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  const embeddingModelId = config.rag.embeddingModelId
  if (!embeddingModelId) {
    const err = new Error(
      'WATSONX_EMBEDDING_MODEL_ID is not configured. ' +
      'Set it in server/.env. Example: ibm/slate-125m-english-rtrvr'
    )
    err.code = 'EMBEDDING_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  _client = new WatsonXAI({
    serviceUrl: url,
    authenticator: new IamAuthenticator({ apikey: apiKey }),
    version: '2024-05-31',
  })

  logger.info('watsonx.ai embedding client initialized', {
    serviceUrl: url,
    embeddingModelId,
  })

  return _client
}

// ── Error mapping ────────────────────────────────────────────────────────────

/**
 * Map SDK error to a safe application-level error.
 * Never expose raw SDK internals, credentials, or token information.
 *
 * @param {Error} err - Raw SDK/network error
 * @returns {Error} Application-level error with .code and .statusCode
 */
function mapSdkError(err) {
  const status = err.status ?? err.statusCode ?? 0
  const message = err.message ?? ''

  const appErr = new Error()
  appErr.stack = err.stack

  if (status === 401 || message.includes('Unauthorized') || message.includes('401')) {
    appErr.code = 'EMBEDDING_AUTH_ERROR'
    appErr.statusCode = 502
    appErr.message = 'Embedding provider authentication failed. Verify WATSONX_API_KEY.'
    return appErr
  }
  if (status === 403 || message.includes('Forbidden') || message.includes('403')) {
    appErr.code = 'EMBEDDING_AUTH_ERROR'
    appErr.statusCode = 502
    appErr.message = 'Embedding provider access denied. Verify WATSONX_PROJECT_ID and IAM permissions.'
    return appErr
  }
  if (
    status === 404 ||
    message.toLowerCase().includes('model not found') ||
    message.toLowerCase().includes('unknown model')
  ) {
    appErr.code = 'EMBEDDING_CONFIGURATION_ERROR'
    appErr.statusCode = 502
    appErr.message = 'Embedding model not found. Verify WATSONX_EMBEDDING_MODEL_ID in .env.'
    return appErr
  }
  if (status === 429 || message.toLowerCase().includes('rate limit')) {
    appErr.code = 'EMBEDDING_RATE_LIMIT'
    appErr.statusCode = 429
    appErr.message = 'Embedding provider rate limit reached. Please wait and try again.'
    return appErr
  }
  if (
    message.toLowerCase().includes('timeout') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ECONNABORTED') ||
    status === 408
  ) {
    appErr.code = 'EMBEDDING_TIMEOUT'
    appErr.statusCode = 504
    appErr.message = 'Embedding provider request timed out.'
    return appErr
  }
  if (status >= 500) {
    appErr.code = 'EMBEDDING_PROVIDER_ERROR'
    appErr.statusCode = 502
    appErr.message = 'Embedding provider is temporarily unavailable.'
    return appErr
  }

  appErr.code = 'EMBEDDING_PROVIDER_ERROR'
  appErr.statusCode = 502
  appErr.message = 'An unexpected error occurred with the embedding provider.'
  return appErr
}

// ── Provider ─────────────────────────────────────────────────────────────────

export const watsonxEmbeddingProvider = {
  /**
   * Generate embeddings for an array of text inputs.
   *
   * The SDK returns embeddings in the same order as the input texts.
   * Input texts must be non-empty strings.
   *
   * @param {string[]} texts - Array of text strings to embed (max per SDK batch = configured)
   * @param {object} [options={}]
   * @param {object} [options.metadata={}] - Optional metadata for structured logging
   * @returns {Promise<{vectors: Array<{index, vector}>, model, provider, usage}>}
   */
  async embed(texts, options = {}) {
    if (!Array.isArray(texts) || texts.length === 0) {
      const err = new Error('embed() requires a non-empty array of text strings.')
      err.code = 'EMBEDDING_INPUT_ERROR'
      err.statusCode = 400
      throw err
    }

    const client = getClient()
    const { projectId, embeddingModelId } = { ...config.watsonx, embeddingModelId: config.rag.embeddingModelId }

    logger.debug('watsonx.ai embedText request', {
      requestId: options.metadata?.requestId,
      modelId: embeddingModelId,
      textCount: texts.length,
    })

    let response
    try {
      response = await client.embedText({
        modelId: embeddingModelId,
        projectId,
        inputs: texts.map((t) => ({ text: t })),
      })
    } catch (err) {
      logger.error('watsonx.ai embedText error', {
        requestId: options.metadata?.requestId,
        provider: 'watsonx-embedding',
        httpStatus: err.status ?? err.statusCode ?? 'N/A',
      })
      throw mapSdkError(err)
    }

    // Normalize the SDK response
    const result = response?.result
    if (!result || !Array.isArray(result.results) || result.results.length === 0) {
      const err = new Error('Embedding provider returned an unexpected or empty response.')
      err.code = 'EMBEDDING_RESPONSE_ERROR'
      err.statusCode = 502
      throw err
    }

    const vectors = result.results.map((item, idx) => ({
      index: idx,
      vector: Array.isArray(item.embedding) ? item.embedding : [],
    }))

    // Verify all embeddings are non-empty
    for (const v of vectors) {
      if (v.vector.length === 0) {
        const err = new Error(`Embedding at index ${v.index} returned an empty vector.`)
        err.code = 'EMBEDDING_RESPONSE_ERROR'
        err.statusCode = 502
        throw err
      }
    }

    const usage = {
      inputTokens: result.usage?.input_token_count ?? null,
    }

    logger.debug('watsonx.ai embedText success', {
      requestId: options.metadata?.requestId,
      vectorCount: vectors.length,
      dimension: vectors[0]?.vector?.length ?? 0,
    })

    return {
      vectors,
      model: result.model_id ?? embeddingModelId,
      provider: 'watsonx',
      usage,
    }
  },

  /**
   * Lightweight health check — validates configuration without an API call.
   *
   * @returns {'connected'|'not-configured'|'error'}
   */
  getHealthStatus() {
    try {
      const { apiKey, projectId } = config.watsonx
      const { embeddingModelId } = config.rag
      if (!apiKey || !projectId || !embeddingModelId) return 'not-configured'
      getClient()
      return 'connected'
    } catch {
      return 'error'
    }
  },
}
