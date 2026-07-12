/**
 * KnowledgeChunk repository — Phase 8.
 *
 * Raw MongoDB driver operations on the `knowledge_chunks` collection.
 * No Mongoose — consistent with Phase 5 architecture.
 *
 * In-memory fallback:
 *   When MongoDB is not available (tests / no-DB mode), an in-memory Map
 *   is used, keyed by chunkId.
 *
 * Architecture:
 *   VectorStore adapter → Repository → MongoDB
 *
 * Vector retrieval (similarity search) is done at the application layer
 * in the vectorStore adapter, not in this repository.
 * The repository only handles persistence.
 */
import { getDb } from '../services/db.service.js'
import logger from '../utils/logger.js'

const COLLECTION = 'knowledge_chunks'

// In-memory store: chunkId → chunk record
const _memStore = new Map()

// ── Collection accessor ───────────────────────────────────────────────────────

function getCollection() {
  try {
    return getDb().collection(COLLECTION)
  } catch {
    return null
  }
}

// ── CRUD operations ───────────────────────────────────────────────────────────

/**
 * Upsert a single chunk record (insert or replace by chunkId).
 *
 * @param {object} chunk - Chunk record from createKnowledgeChunkRecord()
 * @returns {Promise<object>} The upserted chunk
 */
export async function upsertChunk(chunk) {
  const col = getCollection()
  try {
    if (col) {
      await col.replaceOne(
        { chunkId: chunk.chunkId },
        { ...chunk },
        { upsert: true }
      )
    } else {
      _memStore.set(chunk.chunkId, { ...chunk })
    }
    return chunk
  } catch (err) {
    logger.error('KnowledgeChunk upsert failed', { chunkId: chunk.chunkId, error: err.message })
    const appErr = new Error('Failed to persist knowledge chunk.')
    appErr.code = 'CHUNK_PERSISTENCE_ERROR'
    appErr.statusCode = 500
    throw appErr
  }
}

/**
 * Upsert many chunk records in a single operation.
 * Uses bulkWrite for MongoDB; falls back to sequential Map inserts.
 *
 * @param {object[]} chunks
 * @returns {Promise<{upsertedCount: number}>}
 */
export async function upsertChunks(chunks) {
  if (!chunks || chunks.length === 0) return { upsertedCount: 0 }
  const col = getCollection()
  try {
    if (col) {
      const ops = chunks.map((chunk) => ({
        replaceOne: {
          filter: { chunkId: chunk.chunkId },
          replacement: { ...chunk },
          upsert: true,
        },
      }))
      const result = await col.bulkWrite(ops, { ordered: false })
      return { upsertedCount: result.upsertedCount + result.modifiedCount }
    }

    // In-memory fallback
    for (const chunk of chunks) {
      _memStore.set(chunk.chunkId, { ...chunk })
    }
    return { upsertedCount: chunks.length }
  } catch (err) {
    logger.error('KnowledgeChunk bulkUpsert failed', { count: chunks.length, error: err.message })
    const appErr = new Error('Failed to persist knowledge chunks.')
    appErr.code = 'CHUNK_PERSISTENCE_ERROR'
    appErr.statusCode = 500
    throw appErr
  }
}

/**
 * Find all chunks for a given document ID.
 * Excludes the vector field to keep payloads small for metadata queries.
 *
 * @param {string} documentId
 * @param {boolean} [includeVectors=false]
 * @returns {Promise<object[]>}
 */
export async function findChunksByDocumentId(documentId, includeVectors = false) {
  const col = getCollection()
  const projection = includeVectors ? { _id: 0 } : { _id: 0, vector: 0 }
  try {
    if (col) {
      return col
        .find({ documentId }, { projection })
        .sort({ chunkIndex: 1 })
        .toArray()
    }
    const all = Array.from(_memStore.values()).filter((c) => c.documentId === documentId)
    all.sort((a, b) => a.chunkIndex - b.chunkIndex)
    return includeVectors ? all : all.map(({ vector: _v, ...rest }) => rest)
  } catch (err) {
    logger.error('findChunksByDocumentId failed', { documentId, error: err.message })
    return []
  }
}

/**
 * Find all chunks with their vectors (for similarity search).
 * Optionally filter by metadata fields.
 *
 * @param {object} [filters={}]
 * @param {string} [filters.category]
 * @param {string} [filters.language]
 * @returns {Promise<object[]>} Chunks with vector fields included
 */
export async function findAllChunksWithVectors(filters = {}) {
  const col = getCollection()
  try {
    if (col) {
      const query = {}
      if (filters.category) query.category = filters.category
      if (filters.language) query.language = filters.language
      return col.find(query, { projection: { _id: 0 } }).toArray()
    }
    let all = Array.from(_memStore.values())
    if (filters.category) all = all.filter((c) => c.category === filters.category)
    if (filters.language) all = all.filter((c) => c.language === filters.language)
    return all
  } catch (err) {
    logger.error('findAllChunksWithVectors failed', { error: err.message })
    return []
  }
}

/**
 * Delete all chunks for a given document ID.
 *
 * @param {string} documentId
 * @returns {Promise<number>} Number of chunks deleted
 */
export async function deleteChunksByDocumentId(documentId) {
  const col = getCollection()
  try {
    if (col) {
      const result = await col.deleteMany({ documentId })
      return result.deletedCount
    }
    // In-memory fallback
    let count = 0
    for (const [key, chunk] of _memStore.entries()) {
      if (chunk.documentId === documentId) {
        _memStore.delete(key)
        count++
      }
    }
    return count
  } catch (err) {
    logger.error('deleteChunksByDocumentId failed', { documentId, error: err.message })
    const appErr = new Error('Failed to delete knowledge chunks.')
    appErr.code = 'CHUNK_PERSISTENCE_ERROR'
    appErr.statusCode = 500
    throw appErr
  }
}

/**
 * Count total chunks, optionally for a specific document.
 *
 * @param {string} [documentId] - Optional document filter
 * @returns {Promise<number>}
 */
export async function countChunks(documentId) {
  const col = getCollection()
  try {
    const query = documentId ? { documentId } : {}
    if (col) {
      return col.countDocuments(query)
    }
    if (documentId) {
      return Array.from(_memStore.values()).filter((c) => c.documentId === documentId).length
    }
    return _memStore.size
  } catch {
    return 0
  }
}

/**
 * Get the total number of indexed (unique) documents.
 * @returns {Promise<number>}
 */
export async function countIndexedDocuments() {
  const col = getCollection()
  try {
    if (col) {
      const docs = await col.distinct('documentId')
      return docs.length
    }
    const ids = new Set(Array.from(_memStore.values()).map((c) => c.documentId))
    return ids.size
  } catch {
    return 0
  }
}

/**
 * Test helper — clear all in-memory chunks.
 * Not part of the public repository contract.
 */
export function _clearMemStore() {
  _memStore.clear()
}
