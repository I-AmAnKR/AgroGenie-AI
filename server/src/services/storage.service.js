/**
 * Storage service — Phase 7.
 *
 * Coordinates between the storage provider (COS / mock) and the
 * repository (MongoDB metadata).
 *
 * Responsibilities:
 *   - Validate upload metadata
 *   - Sanitize filenames and generate safe unique object keys
 *   - Upload object to COS (real or mock)
 *   - Persist metadata to MongoDB
 *   - List, retrieve, stream, and delete documents
 *   - Compensation logic for partial failures
 *
 * Object key scheme:
 *   {category}/{uuid}-{sanitized-originalName}
 *   e.g. knowledge/crop-guides/a1b2c3d4-wheat-growing-guide.pdf
 *
 * Architecture:
 *   Controller → StorageService → StorageProvider (COS/mock) + Repository
 *
 * This service never imports the COS SDK directly.
 * All COS access goes through the provider interface.
 */
import { v4 as uuidv4 } from 'uuid'
import { getStorageProvider } from '../providers/storage.provider.factory.js'
import {
  createKnowledgeDocumentRecord,
  validateUploadFields,
  ALLOWED_MIME_TYPES,
} from '../models/knowledgeDocument.schema.js'
import {
  createDocument,
  findDocumentById,
  findDocuments,
  softDeleteDocument,
  hardDeleteDocument,
} from '../repositories/knowledgeDocument.repository.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── Filename sanitisation ─────────────────────────────────────────────────────

/**
 * Sanitise a filename for safe use as part of an object key.
 * Removes path components, trims to 100 chars, replaces unsafe chars with '_'.
 *
 * @param {string} name - Original filename from the upload
 * @returns {string} Safe, lowercase filename
 */
function sanitizeFilename(name) {
  // Strip directory traversal attempts
  const base = name.split(/[\\/]/).pop() ?? 'file'
  // Replace any character that is not alphanumeric, dot, dash, or underscore
  return base
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100)
}

/**
 * Generate a unique, safe object key for COS.
 *
 * @param {string} category - Document category (e.g. 'knowledge/crop-guides')
 * @param {string} originalName - Original filename from the upload
 * @returns {string} Unique object key
 */
function generateObjectKey(category, originalName) {
  const id = uuidv4()
  const safe = sanitizeFilename(originalName)
  return `${category}/${id}-${safe}`
}

// ── Upload ────────────────────────────────────────────────────────────────────

/**
 * Upload a document to storage and persist its metadata to MongoDB.
 *
 * Compensation logic:
 *   - If COS upload succeeds but MongoDB fails → attempt COS delete, then throw.
 *   - If MongoDB record creation fails, COS object is cleaned up.
 *
 * @param {Buffer} fileBuffer - Raw file bytes
 * @param {object} meta
 * @param {object} meta.file - multer file object (originalname, mimetype, size)
 * @param {string} meta.category
 * @param {string} meta.title
 * @param {string} meta.organization
 * @param {string} [meta.documentDate]
 * @param {string} [meta.language='en']
 * @param {string[]|string} [meta.tags=[]]
 * @param {string} [meta.sourceUrl='']
 * @param {string} [meta.uploadedBy='anonymous']
 * @returns {Promise<object>} The created document metadata record
 */
export async function uploadDocument(fileBuffer, meta) {
  const { file, category, title, organization, documentDate, language, tags, sourceUrl, uploadedBy } = meta

  // ── Validate upload size ─────────────────────────────────────────────────
  const maxBytes = config.upload.maxBytes
  if (file.size > maxBytes) {
    const err = new Error(
      `File size ${file.size} bytes exceeds the maximum allowed size of ${maxBytes} bytes (${Math.round(maxBytes / 1024 / 1024)} MB).`
    )
    err.code = 'UPLOAD_TOO_LARGE'
    err.statusCode = 413
    throw err
  }

  // ── Validate MIME type (defence-in-depth, also checked by multer filter) ──
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    const err = new Error(`Unsupported file type: ${file.mimetype}`)
    err.code = 'UNSUPPORTED_FILE_TYPE'
    err.statusCode = 415
    throw err
  }

  // ── Normalise tags field (may arrive as comma-string or array) ─────────────
  let normalizedTags = []
  if (Array.isArray(tags)) {
    normalizedTags = tags.map((t) => String(t).trim()).filter(Boolean)
  } else if (typeof tags === 'string' && tags.trim()) {
    normalizedTags = tags.split(',').map((t) => t.trim()).filter(Boolean)
  }

  const storageProvider = getStorageProvider()
  const objectKey = generateObjectKey(category, file.originalname)
  const bucketName = config.providers.useMocks ? 'mock-bucket' : config.cos.bucketName

  // ── Upload to COS ─────────────────────────────────────────────────────────
  logger.info('Uploading document to storage', {
    key: objectKey,
    size: file.size,
    mimeType: file.mimetype,
    category,
  })

  let uploadResult
  try {
    uploadResult = await storageProvider.uploadObject(
      objectKey,
      fileBuffer,
      file.mimetype,
      {
        // COS metadata must be string values
        originalname: file.originalname,
        category,
        title,
        organization,
        uploadedby: uploadedBy ?? 'anonymous',
      }
    )
  } catch (err) {
    logger.error('COS upload failed', { key: objectKey, code: err.code })
    throw err // re-throw provider error
  }

  // ── Persist metadata to MongoDB ───────────────────────────────────────────
  const docRecord = createKnowledgeDocumentRecord({
    originalName: file.originalname,
    objectKey,
    bucketName: uploadResult.bucket ?? bucketName,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    category,
    title,
    organization,
    documentDate: documentDate ?? null,
    language: language ?? 'en',
    tags: normalizedTags,
    sourceUrl: sourceUrl ?? '',
    uploadedBy: uploadedBy ?? 'anonymous',
    storageProvider: config.providers.useMocks ? 'mock' : 'cos',
  })

  try {
    await createDocument(docRecord)
  } catch (err) {
    // Compensation: COS upload succeeded but MongoDB failed.
    // Attempt to delete the orphaned COS object.
    logger.error('Metadata persistence failed — attempting COS cleanup', {
      key: objectKey,
      code: err.code,
    })
    try {
      await storageProvider.deleteObject(objectKey)
      logger.info('COS object cleaned up after metadata failure', { key: objectKey })
    } catch (cleanupErr) {
      logger.error('COS cleanup also failed — orphaned object may exist', {
        key: objectKey,
        cleanupError: cleanupErr.code ?? cleanupErr.message,
      })
    }
    throw err // re-throw the metadata error
  }

  logger.info('Document upload complete', {
    documentId: docRecord.documentId,
    key: objectKey,
    processingStatus: docRecord.processingStatus,
  })

  return docRecord
}

// ── List ──────────────────────────────────────────────────────────────────────

/**
 * List documents with optional filters and pagination.
 *
 * @param {object} [filters={}]
 * @param {object} [pagination={}]
 * @returns {Promise<{documents, total, page, limit}>}
 */
export async function listDocuments(filters = {}, pagination = {}) {
  return findDocuments(filters, pagination)
}

// ── Get by ID ─────────────────────────────────────────────────────────────────

/**
 * Get document metadata by ID.
 * Throws OBJECT_NOT_FOUND if the document does not exist or is deleted.
 *
 * @param {string} documentId
 * @returns {Promise<object>}
 */
export async function getDocumentById(documentId) {
  const doc = await findDocumentById(documentId)
  if (!doc) {
    const err = new Error(`Document "${documentId}" not found.`)
    err.code = 'OBJECT_NOT_FOUND'
    err.statusCode = 404
    throw err
  }
  return doc
}

// ── Stream ────────────────────────────────────────────────────────────────────

/**
 * Get document metadata + a readable stream of the file content.
 *
 * @param {string} documentId
 * @returns {Promise<{doc: object, stream: ReadableStream}>}
 */
export async function getDocumentStream(documentId) {
  const doc = await getDocumentById(documentId)
  const storageProvider = getStorageProvider()

  const stream = await storageProvider.getObjectStream(doc.objectKey)
  return { doc, stream }
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Delete a document from COS and mark it as deleted in MongoDB.
 *
 * Order of operations:
 *   1. Verify metadata exists (throw 404 if not)
 *   2. Delete object from COS
 *   3. Soft-delete MongoDB metadata record
 *
 * If COS deletion fails, the metadata record is NOT soft-deleted and
 * the error is re-thrown — partial failure is reported clearly.
 *
 * @param {string} documentId
 * @returns {Promise<{documentId, deleted: boolean, message: string}>}
 */
export async function deleteDocument(documentId) {
  const doc = await getDocumentById(documentId)

  const storageProvider = getStorageProvider()

  // Step 1: Delete from COS
  try {
    await storageProvider.deleteObject(doc.objectKey)
    logger.info('COS object deleted', { key: doc.objectKey, documentId })
  } catch (err) {
    logger.error('COS deletion failed — metadata record NOT marked deleted', {
      documentId,
      key: doc.objectKey,
      code: err.code,
    })
    // Re-throw — do not report success if COS deletion failed
    throw err
  }

  // Step 2: Soft-delete metadata
  await softDeleteDocument(documentId)

  logger.info('Document deleted', { documentId })

  return {
    documentId,
    deleted: true,
    message: 'Document deleted successfully.',
  }
}
