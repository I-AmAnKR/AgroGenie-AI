/**
 * Knowledge Base API module — Phase 7 + Phase 8.
 *
 * All document storage and RAG operations go through these functions.
 * Communicates only with the Express backend — never with IBM COS or watsonx.ai directly.
 */
import axiosClient from './axiosClient.js'

const BASE = '/knowledge/documents'

// ── Phase 7: Document management ─────────────────────────────────────────────

/**
 * Upload a document.
 * @param {FormData} formData - Must include 'file', 'category', 'title', 'organization'
 * @param {function} [onProgress] - Upload progress callback (0-100)
 */
export async function uploadKnowledgeDocument(formData, onProgress) {
  return axiosClient.post(BASE, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
      ? (e) => {
          const pct = e.total ? Math.round((e.loaded / e.total) * 100) : 0
          onProgress(pct)
        }
      : undefined,
  })
}

/**
 * List documents with optional filters.
 * @param {object} [filters={}]
 * @param {object} [pagination={}]
 */
export async function listKnowledgeDocuments(filters = {}, pagination = {}) {
  const params = { ...filters, ...pagination }
  return axiosClient.get(BASE, { params })
}

/**
 * Get document metadata by ID.
 */
export async function getKnowledgeDocument(documentId) {
  return axiosClient.get(`${BASE}/${documentId}`)
}

/**
 * Get the streaming URL for document content.
 */
export function getDocumentContentUrl(documentId) {
  return `/api/v1${BASE}/${documentId}/content`
}

/**
 * Delete a document (also removes chunks in Phase 8).
 */
export async function deleteKnowledgeDocument(documentId) {
  return axiosClient.delete(`${BASE}/${documentId}`)
}

// ── Phase 8: RAG ingestion ─────────────────────────────────────────────────

/**
 * Trigger RAG ingestion pipeline for a document.
 * @param {string} documentId
 */
export async function processKnowledgeDocument(documentId) {
  return axiosClient.post(`${BASE}/${documentId}/process`)
}

/**
 * Remove existing chunks and re-run the ingestion pipeline.
 * @param {string} documentId
 */
export async function reprocessKnowledgeDocument(documentId) {
  return axiosClient.post(`${BASE}/${documentId}/reprocess`)
}

// ── Phase 8: RAG retrieval ─────────────────────────────────────────────────

/**
 * Retrieve relevant chunks for a query (no Granite generation).
 * @param {string} query
 * @param {number} [topK]
 * @param {object} [filters]
 */
export async function searchKnowledge({ query, topK, filters }) {
  return axiosClient.post('/knowledge/search', { query, topK, filters })
}

/**
 * Retrieval-augmented generation: retrieve chunks + generate Granite answer.
 * @param {string} question
 * @param {string} [language='en']
 * @param {number} [topK]
 * @param {object} [filters]
 */
export async function askKnowledge({ question, language = 'en', topK, filters }) {
  return axiosClient.post('/knowledge/ask', { question, language, topK, filters })
}
