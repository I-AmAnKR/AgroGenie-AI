/**
 * KnowledgeDocument repository — Phase 7.
 *
 * Raw MongoDB driver operations on the `knowledge_documents` collection.
 * No Mongoose. Consistent with Phase 5 architecture.
 *
 * In-memory fallback:
 *   When MongoDB is not available (tests / no-DB mode), an in-memory Map
 *   is used — matching the chat.service.js pattern from Phase 5.
 *
 * Architecture:
 *   Controller → Service → Repository → MongoDB
 *
 * Controllers must not call this repository directly (only via storage.service).
 */
import { getDb } from '../services/db.service.js'
import logger from '../utils/logger.js'

const COLLECTION = 'knowledge_documents'

// In-memory store used when MongoDB is not available (tests / demo without DB).
// Mirrors the pattern used in chat.service.js.
const _memStore = new Map()

// ── Collection accessor ───────────────────────────────────────────────────────

/**
 * Return the MongoDB collection, or null if DB is not connected.
 */
function getCollection() {
  try {
    return getDb().collection(COLLECTION)
  } catch {
    return null
  }
}

// ── CRUD operations ───────────────────────────────────────────────────────────

/**
 * Insert a new KnowledgeDocument record.
 *
 * @param {object} doc - Document record from createKnowledgeDocumentRecord()
 * @returns {Promise<object>} The inserted document (without MongoDB _id)
 */
export async function createDocument(doc) {
  const col = getCollection()
  try {
    if (col) {
      await col.insertOne({ ...doc })
    } else {
      _memStore.set(doc.documentId, { ...doc })
    }
    logger.debug('KnowledgeDocument created', { documentId: doc.documentId })
    return doc
  } catch (err) {
    logger.error('KnowledgeDocument insert failed', { error: err.message })
    const appErr = new Error('Failed to persist document metadata.')
    appErr.code = 'METADATA_PERSISTENCE_ERROR'
    appErr.statusCode = 500
    throw appErr
  }
}

/**
 * Find a single document by its application-level documentId (UUID).
 * Returns null if not found.
 *
 * @param {string} documentId - UUID document ID
 * @returns {Promise<object|null>}
 */
export async function findDocumentById(documentId) {
  const col = getCollection()
  try {
    if (col) {
      return col.findOne({ documentId, status: { $ne: 'deleted' } }, { projection: { _id: 0 } })
    }
    const doc = _memStore.get(documentId)
    return doc && doc.status !== 'deleted' ? doc : null
  } catch (err) {
    logger.error('KnowledgeDocument findById failed', { documentId, error: err.message })
    const appErr = new Error('Failed to retrieve document metadata.')
    appErr.code = 'METADATA_PERSISTENCE_ERROR'
    appErr.statusCode = 500
    throw appErr
  }
}

/**
 * Find a document by ID including soft-deleted (for cleanup purposes).
 *
 * @param {string} documentId
 * @returns {Promise<object|null>}
 */
export async function findDocumentByIdAny(documentId) {
  const col = getCollection()
  try {
    if (col) {
      return col.findOne({ documentId }, { projection: { _id: 0 } })
    }
    return _memStore.get(documentId) ?? null
  } catch (err) {
    logger.error('KnowledgeDocument findByIdAny failed', { documentId, error: err.message })
    const appErr = new Error('Failed to retrieve document metadata.')
    appErr.code = 'METADATA_PERSISTENCE_ERROR'
    appErr.statusCode = 500
    throw appErr
  }
}

/**
 * List documents with optional filters and pagination.
 *
 * @param {object} [filters={}]
 * @param {string} [filters.category]
 * @param {string} [filters.language]
 * @param {string} [filters.organization]
 * @param {string} [filters.processingStatus]
 * @param {string} [filters.status='active']
 * @param {object} [pagination={}]
 * @param {number} [pagination.page=1]
 * @param {number} [pagination.limit=20]
 * @returns {Promise<{documents: object[], total: number, page: number, limit: number}>}
 */
export async function findDocuments(filters = {}, pagination = {}) {
  const page = Math.max(1, parseInt(pagination.page ?? 1, 10))
  const limit = Math.min(100, Math.max(1, parseInt(pagination.limit ?? 20, 10)))
  const skip = (page - 1) * limit

  const targetStatus = filters.status ?? 'active'

  const col = getCollection()
  try {
    if (col) {
      const query = { status: targetStatus }
      if (filters.category) query.category = filters.category
      if (filters.language) query.language = filters.language
      if (filters.organization) query.organization = filters.organization
      if (filters.processingStatus) query.processingStatus = filters.processingStatus

      const [documents, total] = await Promise.all([
        col
          .find(query, { projection: { _id: 0 } })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        col.countDocuments(query),
      ])
      return { documents, total, page, limit }
    }

    // In-memory fallback
    let all = Array.from(_memStore.values())
    all = all.filter((d) => d.status === targetStatus)
    if (filters.category) all = all.filter((d) => d.category === filters.category)
    if (filters.language) all = all.filter((d) => d.language === filters.language)
    if (filters.organization) all = all.filter((d) => d.organization === filters.organization)
    if (filters.processingStatus) all = all.filter((d) => d.processingStatus === filters.processingStatus)

    all.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    const total = all.length
    const documents = all.slice(skip, skip + limit)
    return { documents, total, page, limit }
  } catch (err) {
    logger.error('KnowledgeDocument findDocuments failed', { error: err.message })
    const appErr = new Error('Failed to retrieve document list.')
    appErr.code = 'METADATA_PERSISTENCE_ERROR'
    appErr.statusCode = 500
    throw appErr
  }
}

/**
 * Update a document's status and/or processing status.
 *
 * @param {string} documentId
 * @param {object} updates - Fields to update
 * @returns {Promise<boolean>} true if a document was modified
 */
export async function updateDocumentStatus(documentId, updates) {
  const now = new Date().toISOString()
  const allowed = ['status', 'processingStatus']
  const col = getCollection()

  try {
    if (col) {
      const $set = { updatedAt: now }
      for (const key of allowed) {
        if (updates[key] !== undefined) $set[key] = updates[key]
      }
      const result = await col.updateOne({ documentId }, { $set })
      return result.matchedCount > 0
    }

    // In-memory fallback
    const doc = _memStore.get(documentId)
    if (!doc) return false
    for (const key of allowed) {
      if (updates[key] !== undefined) doc[key] = updates[key]
    }
    doc.updatedAt = now
    return true
  } catch (err) {
    logger.error('KnowledgeDocument updateStatus failed', { documentId, error: err.message })
    const appErr = new Error('Failed to update document status.')
    appErr.code = 'METADATA_PERSISTENCE_ERROR'
    appErr.statusCode = 500
    throw appErr
  }
}

/**
 * Update Phase 8 processing metadata fields on a document.
 * Allows setting arbitrary safe fields (no raw errors stored).
 *
 * Allowed fields: processingStatus, processedAt, chunkCount, embeddingModelId,
 *   embeddingDimension, processingVersion, processingError, processingError
 *
 * @param {string} documentId
 * @param {object} updates
 * @returns {Promise<boolean>}
 */
export async function updateProcessingMetadata(documentId, updates) {
  const now = new Date().toISOString()
  const allowed = [
    'processingStatus',
    'processedAt',
    'chunkCount',
    'embeddingModelId',
    'embeddingDimension',
    'processingVersion',
    'processingError',
  ]
  const col = getCollection()

  try {
    if (col) {
      const $set = { updatedAt: now }
      for (const key of allowed) {
        if (updates[key] !== undefined) $set[key] = updates[key]
      }
      const result = await col.updateOne({ documentId }, { $set })
      return result.matchedCount > 0
    }

    // In-memory fallback
    const doc = _memStore.get(documentId)
    if (!doc) return false
    for (const key of allowed) {
      if (updates[key] !== undefined) doc[key] = updates[key]
    }
    doc.updatedAt = now
    return true
  } catch (err) {
    logger.error('KnowledgeDocument updateProcessingMetadata failed', { documentId, error: err.message })
    const appErr = new Error('Failed to update document processing metadata.')
    appErr.code = 'METADATA_PERSISTENCE_ERROR'
    appErr.statusCode = 500
    throw appErr
  }
}

/**
 * Soft-delete a document — sets status to 'deleted'.
 * The MongoDB record is retained; the COS object may be separately deleted.
 *
 * @param {string} documentId
 * @returns {Promise<boolean>}
 */
export async function softDeleteDocument(documentId) {
  return updateDocumentStatus(documentId, { status: 'deleted' })
}

/**
 * Permanently remove a document record from MongoDB.
 * Use only when the COS object has already been deleted.
 *
 * @param {string} documentId
 * @returns {Promise<boolean>}
 */
export async function hardDeleteDocument(documentId) {
  const col = getCollection()
  try {
    if (col) {
      const result = await col.deleteOne({ documentId })
      return result.deletedCount > 0
    }
    // In-memory fallback
    return _memStore.delete(documentId)
  } catch (err) {
    logger.error('KnowledgeDocument hardDelete failed', { documentId, error: err.message })
    const appErr = new Error('Failed to permanently remove document record.')
    appErr.code = 'METADATA_PERSISTENCE_ERROR'
    appErr.statusCode = 500
    throw appErr
  }
}
