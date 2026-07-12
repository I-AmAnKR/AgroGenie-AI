/**
 * Document Loader — Phase 8 RAG ingestion.
 *
 * Retrieves a document from storage (COS or mock) given its metadata record.
 * Returns the raw buffer and MIME type for downstream extraction.
 *
 * Only reads the binary content — no text extraction is done here.
 * The provider boundary is the storage service / provider, not this module.
 */
import { getStorageProvider } from '../../providers/storage.provider.factory.js'
import logger from '../../utils/logger.js'

/**
 * Load raw document bytes from storage.
 *
 * @param {object} doc - KnowledgeDocument metadata record
 * @param {string} doc.documentId
 * @param {string} doc.objectKey
 * @param {string} doc.mimeType
 * @returns {Promise<{buffer: Buffer, mimeType: string}>}
 */
export async function loadDocumentBuffer(doc) {
  const provider = getStorageProvider()

  logger.debug('Loading document from storage', {
    documentId: doc.documentId,
    objectKey: doc.objectKey,
    mimeType: doc.mimeType,
  })

  let stream
  try {
    stream = await provider.getObjectStream(doc.objectKey)
  } catch (err) {
    logger.error('Failed to retrieve document from storage', {
      documentId: doc.documentId,
      objectKey: doc.objectKey,
      code: err.code ?? 'UNKNOWN',
    })
    // Re-throw with enriched context
    const appErr = new Error(`Failed to load document "${doc.documentId}" from storage: ${err.message}`)
    appErr.code = err.code ?? 'DOCUMENT_LOAD_ERROR'
    appErr.statusCode = err.statusCode ?? 502
    throw appErr
  }

  // Read stream into buffer
  if (Buffer.isBuffer(stream)) {
    return { buffer: stream, mimeType: doc.mimeType }
  }

  const chunks = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const buffer = Buffer.concat(chunks)

  logger.debug('Document buffer loaded', {
    documentId: doc.documentId,
    byteLength: buffer.length,
  })

  return { buffer, mimeType: doc.mimeType }
}
