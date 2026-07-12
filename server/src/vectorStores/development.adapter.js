/**
 * Vector Store — Development Adapter — Phase 8.
 *
 * Application-side cosine similarity search over MongoDB-persisted vectors.
 *
 * This adapter is the correct choice for development and internship-scale
 * knowledge bases (hundreds to low thousands of chunks). It:
 *   - Loads all vectors from MongoDB/in-memory into process memory for search
 *   - Computes cosine similarity in pure JavaScript
 *   - Is persistent across restarts (stored in MongoDB)
 *   - Supports deletion by documentId
 *   - Has a clear interface that makes future migration to Atlas Vector Search
 *     or a dedicated vector database straightforward (replace this file only)
 *
 * Performance note:
 *   For a typical agricultural knowledge base of < 5,000 chunks the linear
 *   scan completes in milliseconds. This is adequate for the current phase.
 *
 * Migration path:
 *   To switch to Atlas Vector Search: implement the same interface but replace
 *   findAllChunksWithVectors() + cosineSimilarity() with a $vectorSearch pipeline.
 *
 * Contract:
 *   upsertChunks(chunks)         → { upsertedCount }
 *   similaritySearch(vector, k, filters, minScore) → ScoredChunk[]
 *   deleteByDocumentId(docId)    → { deletedCount }
 *   healthCheck()                → 'connected' | 'unavailable'
 *   countIndexedDocuments()      → number
 */
import {
  upsertChunks as repoUpsertChunks,
  findAllChunksWithVectors,
  deleteChunksByDocumentId,
  countIndexedDocuments as repoCountIndexedDocuments,
} from '../repositories/knowledgeChunk.repository.js'
import logger from '../utils/logger.js'

// ── Cosine similarity ─────────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two vectors.
 * Returns a value in [-1.0, 1.0]; 1.0 = identical direction.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0

  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// ── Vector Store Adapter ──────────────────────────────────────────────────────

export const vectorStoreAdapter = {
  /**
   * Upsert an array of chunk records (must include .vector fields).
   *
   * @param {object[]} chunks - Array of KnowledgeChunk records with vectors
   * @returns {Promise<{upsertedCount: number}>}
   */
  async upsertChunks(chunks) {
    return repoUpsertChunks(chunks)
  },

  /**
   * Similarity search: find the top-k chunks closest to a query vector.
   *
   * Loads all stored chunks (with vectors) from the repository, computes
   * cosine similarity for each, sorts by score, and returns the top-k
   * chunks above the minimum score threshold.
   *
   * @param {number[]} queryVector - Query embedding vector
   * @param {number} k - Maximum number of results to return
   * @param {object} [filters={}] - Metadata filters (category, language)
   * @param {number} [minScore=0] - Minimum cosine similarity score
   * @returns {Promise<Array<{chunkId, documentId, score, text, pageNumber, title, organization, documentDate, category, language, sourceUrl}>>}
   */
  async similaritySearch(queryVector, k, filters = {}, minScore = 0) {
    const allChunks = await findAllChunksWithVectors(filters)

    if (allChunks.length === 0) return []

    const scored = []
    for (const chunk of allChunks) {
      if (!Array.isArray(chunk.vector) || chunk.vector.length === 0) continue
      const score = cosineSimilarity(queryVector, chunk.vector)
      if (score >= minScore) {
        scored.push({
          chunkId: chunk.chunkId,
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          score,
          text: chunk.text,
          pageNumber: chunk.pageNumber ?? null,
          title: chunk.title,
          organization: chunk.organization,
          documentDate: chunk.documentDate,
          category: chunk.category,
          language: chunk.language,
          sourceUrl: chunk.sourceUrl,
          contentHash: chunk.contentHash,
        })
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, k)
  },

  /**
   * Delete all chunks for a given document ID.
   *
   * @param {string} documentId
   * @returns {Promise<{deletedCount: number}>}
   */
  async deleteByDocumentId(documentId) {
    const deletedCount = await deleteChunksByDocumentId(documentId)
    logger.info('Vector store: deleted chunks for document', { documentId, deletedCount })
    return { deletedCount }
  },

  /**
   * Lightweight health check.
   * The repository uses MongoDB when available, with an in-memory fallback.
   * We report 'connected' in both cases since the store is always functional.
   *
   * @returns {Promise<'connected'|'unavailable'>}
   */
  async healthCheck() {
    try {
      await repoCountIndexedDocuments()
      return 'connected'
    } catch {
      return 'unavailable'
    }
  },

  /**
   * Return the count of indexed documents.
   * @returns {Promise<number>}
   */
  async countIndexedDocuments() {
    return repoCountIndexedDocuments()
  },
}
