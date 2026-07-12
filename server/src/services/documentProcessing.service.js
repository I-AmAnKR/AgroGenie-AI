/**
 * Document Processing Service — Phase 8.
 *
 * Orchestrates the full RAG ingestion pipeline for a single document:
 *
 *   1. Validate document exists and is active
 *   2. Set processingStatus → processing
 *   3. Retrieve document bytes from COS
 *   4. Extract text (PDF or plain text)
 *   5. Clean text
 *   6. Create chunks with metadata
 *   7. Generate embeddings in safe batches
 *   8. Assemble chunk records with vectors
 *   9. Upsert chunks to vector store
 *  10. Update document processingStatus → processed
 *  11. Save processing metadata (chunkCount, embeddingModelId, etc.)
 *  12. Return processing summary
 *
 * On any failure:
 *   - processingStatus → failed
 *   - Safe error category stored (no raw SDK errors)
 *
 * Reprocessing:
 *   - Remove existing chunks before regenerating to avoid duplicates
 *   - Content hashes allow detecting unchanged chunks on future runs
 */
import {
  findDocumentById,
  updateProcessingMetadata,
} from '../repositories/knowledgeDocument.repository.js'
import { loadDocumentBuffer } from '../rag/ingestion/documentLoader.js'
import { extractText } from '../rag/ingestion/textExtractor.js'
import { cleanText, cleanPages } from '../rag/ingestion/textCleaner.js'
import { createChunks } from '../rag/ingestion/chunker.js'
import { embedTexts } from './embedding.service.js'
import { vectorStoreAdapter } from '../vectorStores/development.adapter.js'
import { createKnowledgeChunkRecord } from '../models/knowledgeChunk.schema.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── Error category mapping ────────────────────────────────────────────────────

/**
 * Map a caught error to a safe category string.
 * Never stores raw SDK or provider messages.
 *
 * @param {Error} err
 * @returns {string}
 */
function categorizeError(err) {
  const code = err.code ?? ''
  if (code === 'EXTRACTION_EMPTY') return 'empty_extraction'
  if (code === 'EXTRACTION_ERROR') return 'extraction_failed'
  if (code === 'UNSUPPORTED_MIME_TYPE') return 'unsupported_mime_type'
  if (code === 'DOCUMENT_LOAD_ERROR' || code === 'OBJECT_NOT_FOUND') return 'document_load_failed'
  if (code.startsWith('EMBEDDING_AUTH')) return 'embedding_auth_error'
  if (code.startsWith('EMBEDDING_CONFIGURATION')) return 'embedding_configuration_error'
  if (code.startsWith('EMBEDDING')) return 'embedding_failed'
  if (code === 'CHUNK_PERSISTENCE_ERROR') return 'chunk_persistence_failed'
  return 'unknown_error'
}

// ── Main processing function ──────────────────────────────────────────────────

/**
 * Process a knowledge document: extract → chunk → embed → index.
 *
 * @param {string} documentId - UUID of the document to process
 * @param {object} [options={}]
 * @param {boolean} [options.isReprocess=false] - If true, remove old chunks first
 * @returns {Promise<object>} Processing summary
 */
export async function processDocument(documentId, options = {}) {
  const { isReprocess = false } = options

  // ── Step 1: Load and validate document ──────────────────────────────────────
  const doc = await findDocumentById(documentId)
  if (!doc) {
    const err = new Error(`Document "${documentId}" not found.`)
    err.code = 'OBJECT_NOT_FOUND'
    err.statusCode = 404
    throw err
  }

  if (doc.status !== 'active') {
    const err = new Error(`Document "${documentId}" is not active (status: ${doc.status}).`)
    err.code = 'DOCUMENT_NOT_ACTIVE'
    err.statusCode = 409
    throw err
  }

  logger.info('Starting document processing', {
    documentId,
    mimeType: doc.mimeType,
    title: doc.title,
    isReprocess,
  })

  // ── Step 2: Set status → processing ─────────────────────────────────────────
  await updateProcessingMetadata(documentId, {
    processingStatus: 'processing',
    processingError: null,
  })

  try {
    // ── Step 3: Remove old chunks if reprocessing ──────────────────────────────
    let oldChunkCount = 0
    if (isReprocess) {
      const result = await vectorStoreAdapter.deleteByDocumentId(documentId)
      oldChunkCount = result.deletedCount
      logger.info('Removed old chunks for reprocessing', { documentId, oldChunkCount })
    }

    // ── Step 4: Retrieve document bytes ─────────────────────────────────────────
    const { buffer, mimeType } = await loadDocumentBuffer(doc)

    // ── Step 5: Extract text ─────────────────────────────────────────────────────
    const { text: rawText, pages: rawPages } = await extractText(buffer, mimeType)

    // ── Step 6: Clean text ───────────────────────────────────────────────────────
    const cleanedText = cleanText(rawText)
    const cleanedPages = cleanPages(rawPages)

    // ── Step 7: Create chunks ────────────────────────────────────────────────────
    const processingVersion = config.rag.processingVersion
    const chunkDefs = createChunks({
      documentId,
      text: cleanedText,
      pages: cleanedPages,
      docMeta: doc,
      processingVersion,
    })

    if (chunkDefs.length === 0) {
      const err = new Error('Document produced zero chunks after cleaning and splitting.')
      err.code = 'EXTRACTION_EMPTY'
      err.statusCode = 422
      throw err
    }

    logger.info('Chunks created', {
      documentId,
      chunkCount: chunkDefs.length,
      processingVersion,
    })

    // ── Step 8: Generate embeddings in batches ───────────────────────────────────
    const chunkTexts = chunkDefs.map((c) => c.text)

    const embeddingResult = await embedTexts(chunkTexts, {
      metadata: { documentId },
    })

    const embeddingModelId = embeddingResult.model
    const embeddingDimension = embeddingResult.embeddings[0]?.vector?.length ?? 0

    // ── Step 9: Assemble chunk records with vectors ──────────────────────────────
    const chunkRecords = chunkDefs.map((chunkDef, idx) => {
      const vectorEntry = embeddingResult.embeddings.find((e) => e.index === idx)
      if (!vectorEntry || !vectorEntry.vector || vectorEntry.vector.length === 0) {
        const err = new Error(`Missing embedding for chunk at index ${idx}.`)
        err.code = 'EMBEDDING_RESPONSE_ERROR'
        err.statusCode = 502
        throw err
      }
      return createKnowledgeChunkRecord({
        ...chunkDef,
        vector: vectorEntry.vector,
        embeddingModelId,
      })
    })

    // ── Step 10: Upsert to vector store ──────────────────────────────────────────
    const { upsertedCount } = await vectorStoreAdapter.upsertChunks(chunkRecords)

    logger.info('Chunks indexed in vector store', {
      documentId,
      upsertedCount,
      embeddingModelId,
      embeddingDimension,
    })

    // ── Step 11: Update document metadata → processed ────────────────────────────
    const now = new Date().toISOString()
    await updateProcessingMetadata(documentId, {
      processingStatus: 'processed',
      processedAt: now,
      chunkCount: chunkRecords.length,
      embeddingModelId,
      embeddingDimension,
      processingVersion,
      processingError: null,
    })

    // ── Step 12: Return summary ───────────────────────────────────────────────────
    const summary = {
      documentId,
      processingStatus: 'processed',
      chunkCount: chunkRecords.length,
      embeddingModelId,
      embeddingDimension,
      processingVersion,
      processedAt: now,
      isReprocess,
      oldChunkCount,
    }

    logger.info('Document processing complete', summary)
    return summary
  } catch (err) {
    // ── Failure path: update status → failed ─────────────────────────────────
    const errorCategory = categorizeError(err)
    logger.error('Document processing failed', {
      documentId,
      errorCategory,
      errorCode: err.code ?? 'UNKNOWN',
      // Never log raw err.message as it may contain provider details
    })

    try {
      await updateProcessingMetadata(documentId, {
        processingStatus: 'failed',
        processingError: errorCategory,
      })
    } catch (metaErr) {
      logger.error('Failed to update processingStatus to failed', {
        documentId,
        metaError: metaErr.message,
      })
    }

    // Re-throw for the controller to handle
    throw err
  }
}
