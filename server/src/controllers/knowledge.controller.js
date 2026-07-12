/**
 * Knowledge controller — Phase 8 extension.
 *
 * Phase 7 handlers are preserved unchanged.
 * Phase 8 adds: process, reprocess, search, ask, and chunk-deletion on delete.
 *
 * Architecture:
 *   Route → Controller → Service → (Provider + Repository)
 *
 * Security:
 *   - No COS credentials returned in any response.
 *   - No raw SDK errors returned.
 *   - No embedding vectors exposed through API.
 *   - Processing error categories only (no raw error messages from providers).
 */
import multer from 'multer'
import { Readable } from 'stream'
import {
  uploadDocument,
  listDocuments,
  getDocumentById,
  getDocumentStream,
  deleteDocument,
} from '../services/storage.service.js'
import { processDocument } from '../services/documentProcessing.service.js'
import { searchKnowledge, askKnowledge } from '../services/rag.service.js'
import { ALLOWED_MIME_TYPES, validateUploadFields } from '../models/knowledgeDocument.schema.js'
import { success, error, validationError, notFoundError } from '../utils/apiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── Multer setup ──────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxBytes },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      const err = new Error(`Unsupported file type: ${file.mimetype}`)
      err.code = 'UNSUPPORTED_FILE_TYPE'
      err.statusCode = 415
      cb(err)
    }
  },
})

function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMB = Math.round(config.upload.maxBytes / 1024 / 1024)
      return error(res, 'UPLOAD_TOO_LARGE', `File exceeds the ${maxMB} MB upload limit.`, 413)
    }
    return error(res, 'UPLOAD_ERROR', err.message, 400)
  }
  if (err?.code === 'UNSUPPORTED_FILE_TYPE') {
    return error(res, 'UNSUPPORTED_FILE_TYPE', err.message, 415)
  }
  next(err)
}

// ── Error code → HTTP status mapping ─────────────────────────────────────────

const STORAGE_ERROR_STATUS = {
  STORAGE_CONFIGURATION_ERROR: 500,
  STORAGE_AUTH_ERROR: 502,
  STORAGE_ACCESS_DENIED: 502,
  BUCKET_NOT_FOUND: 502,
  OBJECT_NOT_FOUND: 404,
  UPLOAD_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  STORAGE_PROVIDER_ERROR: 502,
  METADATA_PERSISTENCE_ERROR: 503,
}

const PROCESSING_ERROR_STATUS = {
  OBJECT_NOT_FOUND: 404,
  DOCUMENT_NOT_ACTIVE: 409,
  EXTRACTION_EMPTY: 422,
  EXTRACTION_ERROR: 422,
  UNSUPPORTED_MIME_TYPE: 415,
  DOCUMENT_LOAD_ERROR: 502,
  EMBEDDING_AUTH_ERROR: 502,
  EMBEDDING_CONFIGURATION_ERROR: 500,
  EMBEDDING_RATE_LIMIT: 429,
  EMBEDDING_TIMEOUT: 504,
  EMBEDDING_PROVIDER_ERROR: 502,
}

function mapStorageError(err, res) {
  const code = err.code ?? 'STORAGE_PROVIDER_ERROR'
  const statusCode = err.statusCode ?? STORAGE_ERROR_STATUS[code] ?? 500
  const message = err.message ?? 'A storage error occurred.'
  return error(res, code, message, statusCode)
}

function mapProcessingError(err, res) {
  const code = err.code ?? 'PROCESSING_ERROR'
  const statusCode = err.statusCode ?? PROCESSING_ERROR_STATUS[code] ?? 500
  const message = err.message ?? 'A processing error occurred.'
  return error(res, code, message, statusCode)
}

// ── Phase 7 Handlers (unchanged) ─────────────────────────────────────────────

/**
 * POST /api/v1/knowledge/documents
 */
export const uploadDocumentHandler = [
  upload.single('file'),
  handleMulterError,
  asyncHandler(async (req, res) => {
    const { category, title, organization, documentDate, language, tags, sourceUrl } = req.body
    const file = req.file

    const errors = validateUploadFields({ file, category, title, organization })
    if (errors.length > 0) {
      return validationError(res, errors[0], errors)
    }

    const uploadedBy = req.body.uploadedBy ?? 'anonymous'

    try {
      const doc = await uploadDocument(file.buffer, {
        file,
        category: category.trim(),
        title: String(title).trim(),
        organization: String(organization).trim(),
        documentDate: documentDate ?? null,
        language: language ?? 'en',
        tags: tags ?? [],
        sourceUrl: sourceUrl ?? '',
        uploadedBy,
      })

      logger.info('Document upload request succeeded', {
        requestId: res.locals.requestId,
        documentId: doc.documentId,
      })

      return success(res, { document: doc }, 201)
    } catch (err) {
      return mapStorageError(err, res)
    }
  }),
]

/**
 * GET /api/v1/knowledge/documents
 */
export const listDocumentsHandler = asyncHandler(async (req, res) => {
  const { category, language, organization, processingStatus, status, page, limit } = req.query

  try {
    const result = await listDocuments(
      { category, language, organization, processingStatus, status },
      { page, limit }
    )

    return success(res, {
      documents: result.documents,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: Math.ceil(result.total / result.limit),
      },
    })
  } catch (err) {
    return mapStorageError(err, res)
  }
})

/**
 * GET /api/v1/knowledge/documents/:documentId
 */
export const getDocumentHandler = asyncHandler(async (req, res) => {
  const { documentId } = req.params

  try {
    const doc = await getDocumentById(documentId)
    return success(res, { document: doc })
  } catch (err) {
    if (err.code === 'OBJECT_NOT_FOUND') return notFoundError(res, err.message)
    return mapStorageError(err, res)
  }
})

/**
 * GET /api/v1/knowledge/documents/:documentId/content
 */
export const getDocumentContentHandler = asyncHandler(async (req, res) => {
  const { documentId } = req.params

  try {
    const { doc, stream } = await getDocumentStream(documentId)

    res.setHeader('Content-Type', doc.mimeType ?? 'application/octet-stream')
    res.setHeader('Content-Length', doc.sizeBytes)
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(doc.originalName)}"`
    )
    res.setHeader('X-Document-Id', doc.documentId)

    if (stream && typeof stream.pipe === 'function') {
      stream.on('error', (streamErr) => {
        logger.error('Stream error during document content delivery', {
          documentId,
          code: streamErr.code ?? 'STREAM_ERROR',
        })
        if (!res.headersSent) {
          error(res, 'STORAGE_PROVIDER_ERROR', 'Error streaming document content.', 502)
        }
      })
      stream.pipe(res)
    } else if (Buffer.isBuffer(stream)) {
      res.send(stream)
    } else {
      const readable = stream instanceof Readable ? stream : Readable.from(stream)
      const chunks = []
      for await (const chunk of readable) {
        chunks.push(chunk)
      }
      res.send(Buffer.concat(chunks))
    }
  } catch (err) {
    if (err.code === 'OBJECT_NOT_FOUND') return notFoundError(res, err.message)
    return mapStorageError(err, res)
  }
})

/**
 * DELETE /api/v1/knowledge/documents/:documentId
 * Phase 8: also removes vector/chunk records before deleting from COS.
 */
export const deleteDocumentHandler = asyncHandler(async (req, res) => {
  const { documentId } = req.params

  try {
    // Step 1: Remove vector/chunk index entries (Phase 8 addition)
    // Import vectorStoreAdapter lazily to avoid circular deps in Phase 7 tests
    const { vectorStoreAdapter } = await import('../vectorStores/development.adapter.js')
    const { deletedCount } = await vectorStoreAdapter.deleteByDocumentId(documentId)
    logger.info('Removed chunks before document delete', { documentId, deletedCount })
  } catch (chunkErr) {
    // Non-fatal: log but continue with document deletion
    logger.warn('Failed to remove chunks before document delete — continuing', {
      documentId,
      error: chunkErr.code ?? chunkErr.message,
    })
  }

  try {
    const result = await deleteDocument(documentId)
    return success(res, result)
  } catch (err) {
    if (err.code === 'OBJECT_NOT_FOUND') return notFoundError(res, err.message)
    return mapStorageError(err, res)
  }
})

// ── Phase 8 Handlers ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/knowledge/documents/:documentId/process
 * Trigger RAG ingestion pipeline for a single document.
 */
export const processDocumentHandler = asyncHandler(async (req, res) => {
  const { documentId } = req.params

  logger.info('Document process request', {
    requestId: res.locals.requestId,
    documentId,
  })

  try {
    const summary = await processDocument(documentId, { isReprocess: false })
    return success(res, { processing: summary })
  } catch (err) {
    return mapProcessingError(err, res)
  }
})

/**
 * POST /api/v1/knowledge/documents/:documentId/reprocess
 * Remove existing chunks and re-run the full ingestion pipeline.
 */
export const reprocessDocumentHandler = asyncHandler(async (req, res) => {
  const { documentId } = req.params

  logger.info('Document reprocess request', {
    requestId: res.locals.requestId,
    documentId,
  })

  try {
    const summary = await processDocument(documentId, { isReprocess: true })
    return success(res, { processing: summary })
  } catch (err) {
    return mapProcessingError(err, res)
  }
})

/**
 * POST /api/v1/knowledge/search
 * Retrieve relevant chunks for a query (no Granite generation).
 *
 * Body: { query, topK?, filters?: { category?, language? } }
 */
export const searchKnowledgeHandler = asyncHandler(async (req, res) => {
  const { query, topK, filters } = req.body ?? {}

  if (!query || typeof query !== 'string' || !query.trim()) {
    return validationError(res, 'query is required and must be a non-empty string.')
  }

  if (topK !== undefined && (!Number.isInteger(topK) || topK < 1 || topK > 20)) {
    return validationError(res, 'topK must be an integer between 1 and 20.')
  }

  try {
    const result = await searchKnowledge({
      query: query.trim(),
      topK: topK ?? undefined,
      filters: filters ?? {},
    })
    return success(res, result)
  } catch (err) {
    const code = err.code ?? 'SEARCH_ERROR'
    const statusCode = err.statusCode ?? 500
    return error(res, code, err.message ?? 'Search failed.', statusCode)
  }
})

/**
 * POST /api/v1/knowledge/ask
 * Retrieval-augmented generation: retrieve chunks + generate Granite answer.
 *
 * Body: { question, language?, topK?, filters?: { category?, language? } }
 */
export const askKnowledgeHandler = asyncHandler(async (req, res) => {
  const { question, language, topK, filters } = req.body ?? {}

  if (!question || typeof question !== 'string' || !question.trim()) {
    return validationError(res, 'question is required and must be a non-empty string.')
  }

  if (topK !== undefined && (!Number.isInteger(topK) || topK < 1 || topK > 20)) {
    return validationError(res, 'topK must be an integer between 1 and 20.')
  }

  try {
    const result = await askKnowledge({
      question: question.trim(),
      language: language ?? 'en',
      topK: topK ?? undefined,
      filters: filters ?? {},
      metadata: { requestId: res.locals.requestId },
    })
    return success(res, result)
  } catch (err) {
    const code = err.code ?? 'RAG_ERROR'
    const statusCode = err.statusCode ?? 500
    return error(res, code, err.message ?? 'RAG ask failed.', statusCode)
  }
})
