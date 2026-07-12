/**
 * Embedding Provider Factory — Phase 8.
 *
 * Single location for embedding provider selection.
 * No scattered process.env checks in services.
 *
 * Provider selection:
 *   USE_MOCK_PROVIDERS=true  → MockEmbeddingProvider
 *   USE_MOCK_PROVIDERS=false → WatsonxEmbeddingProvider
 *
 * If real mode is selected but the embedding model configuration is absent,
 * this throws EMBEDDING_CONFIGURATION_ERROR rather than silently falling back
 * to mock. Silent fallback would hide misconfiguration.
 */
import config from '../config/env.js'
import { mockEmbeddingProvider } from './mock/mock-embedding.provider.js'
import { watsonxEmbeddingProvider } from './watsonx-embedding.provider.js'

/**
 * Return the configured embedding provider instance.
 *
 * @throws {Error} EMBEDDING_CONFIGURATION_ERROR when real mode is selected without valid config.
 * @returns {object} The active embedding provider implementing the embed() interface.
 */
export function getEmbeddingProvider() {
  if (config.providers.useMocks) {
    return mockEmbeddingProvider
  }

  // Real mode — validate required config before returning the provider.
  const { apiKey, projectId } = config.watsonx
  const { embeddingModelId } = config.rag

  if (!apiKey || !projectId) {
    const err = new Error(
      'USE_MOCK_PROVIDERS=false requires WATSONX_API_KEY and WATSONX_PROJECT_ID. ' +
        'Set them in server/.env or set USE_MOCK_PROVIDERS=true for demo mode.'
    )
    err.code = 'EMBEDDING_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  if (!embeddingModelId) {
    const err = new Error(
      'USE_MOCK_PROVIDERS=false requires WATSONX_EMBEDDING_MODEL_ID for RAG operations. ' +
        'Set it in server/.env (e.g. ibm/slate-125m-english-rtrvr) or set USE_MOCK_PROVIDERS=true.'
    )
    err.code = 'EMBEDDING_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  return watsonxEmbeddingProvider
}

/**
 * Return the embedding health status without a live API call.
 *
 * @returns {'mock'|'connected'|'not-configured'|'error'}
 */
export function getEmbeddingHealthStatus() {
  if (config.providers.useMocks) return 'mock'
  return watsonxEmbeddingProvider.getHealthStatus()
}
