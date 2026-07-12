/**
 * Embedding service — Phase 8.
 *
 * Wraps the embedding provider with safe batching, retry logic,
 * and application-level input validation.
 *
 * Services that need embeddings should use this module, not the provider directly.
 *
 * Batching:
 *   Chunks are split into batches of RAG_EMBEDDING_BATCH_SIZE (default: 10).
 *   Each batch is submitted sequentially to respect rate limits.
 *   Retry is limited to transient errors (timeout, 5xx) — auth/config errors
 *   fail immediately without retry.
 *
 * The provider is resolved once per embed() call; the factory handles mock vs real.
 */
import { getEmbeddingProvider } from '../providers/embedding.provider.factory.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// Error codes that should NOT be retried (auth/config/input problems)
const NON_RETRYABLE_CODES = new Set([
  'EMBEDDING_AUTH_ERROR',
  'EMBEDDING_CONFIGURATION_ERROR',
  'EMBEDDING_INPUT_ERROR',
])

// Maximum retries for transient errors
const MAX_RETRIES = 2
// Delay between retries (ms)
const RETRY_DELAY_MS = 1000

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Embed a single batch with retry logic for transient errors.
 *
 * @param {object} provider - Embedding provider instance
 * @param {string[]} batch - Text strings in this batch
 * @param {object} [metadata={}] - Request metadata for logging
 * @returns {Promise<Array<{index, vector}>>}
 */
async function embedBatchWithRetry(provider, batch, metadata = {}) {
  let lastError
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await provider.embed(batch, { metadata })
      return result.vectors
    } catch (err) {
      lastError = err
      if (NON_RETRYABLE_CODES.has(err.code)) {
        throw err
      }
      if (attempt < MAX_RETRIES) {
        logger.warn('Embedding batch failed — retrying', {
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          errorCode: err.code ?? 'UNKNOWN',
        })
        await sleep(RETRY_DELAY_MS * (attempt + 1))
      }
    }
  }
  throw lastError
}

/**
 * Generate embeddings for an array of text strings.
 *
 * The input array is split into batches of `config.rag.embeddingBatchSize`.
 * Results are reassembled in input order and returned as a flat array.
 *
 * @param {string[]} texts - Array of text strings to embed
 * @param {object} [options={}]
 * @param {object} [options.metadata={}] - Optional metadata for structured logging
 * @returns {Promise<{
 *   embeddings: Array<{index: number, vector: number[]}>,
 *   model: string,
 *   provider: string
 * }>}
 */
export async function embedTexts(texts, options = {}) {
  if (!Array.isArray(texts) || texts.length === 0) {
    const err = new Error('embedTexts() requires a non-empty array of text strings.')
    err.code = 'EMBEDDING_INPUT_ERROR'
    err.statusCode = 400
    throw err
  }

  // Validate no empty strings
  for (let i = 0; i < texts.length; i++) {
    if (!texts[i] || typeof texts[i] !== 'string' || texts[i].trim().length === 0) {
      const err = new Error(`Text at index ${i} is empty or not a string.`)
      err.code = 'EMBEDDING_INPUT_ERROR'
      err.statusCode = 400
      throw err
    }
  }

  const batchSize = config.rag.embeddingBatchSize
  const provider = getEmbeddingProvider()

  const allVectors = []
  let model = ''
  let providerName = ''

  // Split into batches and embed sequentially
  for (let start = 0; start < texts.length; start += batchSize) {
    const batch = texts.slice(start, start + batchSize)

    logger.debug('Embedding batch', {
      batchStart: start,
      batchSize: batch.length,
      totalTexts: texts.length,
    })

    // Use full provider.embed to get model/provider info from last batch
    let batchResult
    try {
      batchResult = await provider.embed(batch, { metadata: options.metadata ?? {} })
    } catch (err) {
      if (NON_RETRYABLE_CODES.has(err.code)) throw err
      // Retry for transient errors
      batchResult = { vectors: await embedBatchWithRetry(provider, batch, options.metadata ?? {}), model: '', provider: '' }
    }

    // Track model/provider from each batch (last batch wins — consistent)
    if (batchResult.model) model = batchResult.model
    if (batchResult.provider) providerName = batchResult.provider

    // Re-offset indices to global positions
    for (const v of batchResult.vectors) {
      allVectors.push({
        index: start + v.index,
        vector: v.vector,
      })
    }
  }

  logger.info('Embedding complete', {
    totalTexts: texts.length,
    vectorCount: allVectors.length,
    model,
    dimension: allVectors[0]?.vector?.length ?? 0,
  })

  return {
    embeddings: allVectors,
    model,
    provider: providerName,
  }
}

/**
 * Embed a single query text.
 * Convenience wrapper around embedTexts() for single-query use.
 *
 * @param {string} text - Query text to embed
 * @param {object} [options={}]
 * @returns {Promise<{vector: number[], model: string, provider: string}>}
 */
export async function embedQuery(text, options = {}) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    const err = new Error('embedQuery() requires a non-empty text string.')
    err.code = 'EMBEDDING_INPUT_ERROR'
    err.statusCode = 400
    throw err
  }

  const result = await embedTexts([text], options)
  return {
    vector: result.embeddings[0].vector,
    model: result.model,
    provider: result.provider,
  }
}
