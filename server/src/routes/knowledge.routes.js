/**
 * Knowledge Base routes — Phase 7 + Phase 8.
 *
 * Mounted at: /api/v1/knowledge
 *
 * Phase 7 endpoints:
 *   POST   /documents                          — upload document
 *   GET    /documents                          — list documents (filters + pagination)
 *   GET    /documents/:documentId              — document metadata
 *   GET    /documents/:documentId/content      — stream document content
 *   DELETE /documents/:documentId              — delete document (+ chunks in Phase 8)
 *
 * Phase 8 endpoints:
 *   POST   /documents/:documentId/process      — trigger RAG ingestion pipeline
 *   POST   /documents/:documentId/reprocess    — remove old chunks + re-index
 *   POST   /search                             — similarity search (retrieval only)
 *   POST   /ask                                — RAG answer via IBM Granite
 */
import { Router } from 'express'
import {
  uploadDocumentHandler,
  listDocumentsHandler,
  getDocumentHandler,
  getDocumentContentHandler,
  deleteDocumentHandler,
  processDocumentHandler,
  reprocessDocumentHandler,
  searchKnowledgeHandler,
  askKnowledgeHandler,
} from '../controllers/knowledge.controller.js'

const router = Router()

// ── Phase 7: Document management ─────────────────────────────────────────────

router.post('/documents', uploadDocumentHandler)
router.get('/documents', listDocumentsHandler)
router.get('/documents/:documentId', getDocumentHandler)
router.get('/documents/:documentId/content', getDocumentContentHandler)
router.delete('/documents/:documentId', deleteDocumentHandler)

// ── Phase 8: RAG ingestion ───────────────────────────────────────────────────

router.post('/documents/:documentId/process', processDocumentHandler)
router.post('/documents/:documentId/reprocess', reprocessDocumentHandler)

// ── Phase 8: RAG retrieval ───────────────────────────────────────────────────

router.post('/search', searchKnowledgeHandler)
router.post('/ask', askKnowledgeHandler)

export default router
