/**
 * Mock Embedding Provider — Phase 8.
 *
 * Implements the normalized embedding provider interface:
 *   embed(texts, options)
 *   → { vectors: [{ index, vector }], model, provider, usage }
 *
 * Generates deterministic pseudo-random vectors based on text content hash.
 * Semantically similar texts will NOT produce similar vectors (this is fine
 * for integration tests — similarity search is tested via the vector store adapter).
 *
 * The vectors have a fixed dimension of 384 to match ibm/slate-30m-english-rtrvr.
 * Cosine similarity between mock vectors will be near-random, so RAG retrieval
 * in mock mode returns results by insertion order as the fallback.
 *
 * Used when USE_MOCK_PROVIDERS=true.
 */

const MOCK_DIMENSION = 384

/**
 * Generate a deterministic pseudo-random float vector from a seed string.
 * Uses a simple xorshift seeded by char codes.
 *
 * @param {string} seed
 * @param {number} dimension
 * @returns {number[]}
 */
function deterministicVector(seed, dimension) {
  let state = 0
  for (let i = 0; i < seed.length; i++) {
    state = (state * 31 + seed.charCodeAt(i)) & 0x7fffffff
  }

  const vec = new Array(dimension)
  for (let i = 0; i < dimension; i++) {
    // xorshift32 step
    state ^= state << 13
    state ^= state >> 17
    state ^= state << 5
    state = state & 0x7fffffff
    // Map to [-1, 1]
    vec[i] = (state / 0x7fffffff) * 2 - 1
  }

  // L2-normalize the vector
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  return norm > 0 ? vec.map((v) => v / norm) : vec
}

export const mockEmbeddingProvider = {
  /**
   * Generate mock embeddings for an array of text inputs.
   * Returns deterministic vectors based on text content.
   *
   * @param {string[]} texts
   * @param {object} [_options={}]
   * @returns {Promise<{vectors: Array<{index, vector}>, model, provider, usage}>}
   */
  async embed(texts, _options = {}) {
    if (!Array.isArray(texts) || texts.length === 0) {
      const err = new Error('embed() requires a non-empty array of text strings.')
      err.code = 'EMBEDDING_INPUT_ERROR'
      err.statusCode = 400
      throw err
    }

    const vectors = texts.map((text, idx) => ({
      index: idx,
      vector: deterministicVector(text, MOCK_DIMENSION),
    }))

    return {
      vectors,
      model: 'mock-embedding-384d',
      provider: 'mock',
      usage: { inputTokens: null },
    }
  },

  /**
   * Health status for mock provider.
   * @returns {'mock'}
   */
  getHealthStatus() {
    return 'mock'
  },

  /**
   * Expose the mock dimension for tests.
   */
  _dimension: MOCK_DIMENSION,
}
