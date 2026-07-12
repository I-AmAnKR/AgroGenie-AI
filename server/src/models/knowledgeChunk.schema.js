/**
 * KnowledgeChunk schema — Phase 8.
 *
 * Represents a single text chunk from a processed KnowledgeDocument.
 * Each chunk has its embedding vector stored alongside metadata.
 *
 * No Mongoose — plain JS factory consistent with Phase 5 architecture.
 *
 * Storage: MongoDB collection `knowledge_chunks`.
 * The vector field holds the full float array for application-side cosine similarity.
 * This is appropriate for development-scale knowledge bases (~hundreds to low thousands
 * of chunks). Future migration to Atlas Vector Search or a dedicated vector DB
 * can be done by replacing the vectorStore adapter only.
 */

/**
 * Create a new KnowledgeChunk record.
 * Does NOT insert into MongoDB — caller must do that via the repository.
 *
 * @param {object} fields
 * @param {string} fields.chunkId - Deterministic chunk ID ({documentId}-chunk-{idx})
 * @param {string} fields.documentId - Parent document UUID
 * @param {number} fields.chunkIndex - Position within the document
 * @param {string} fields.text - Chunk text (clean, ready for indexing)
 * @param {number|null} [fields.pageNumber=null] - Source page number or null
 * @param {string} fields.title - Document title
 * @param {string} fields.organization - Publishing organization
 * @param {string|null} [fields.documentDate=null] - Document date
 * @param {string} fields.category - Document category
 * @param {string} [fields.language='en'] - Language code
 * @param {string} [fields.sourceUrl=''] - Source URL if available
 * @param {string} fields.contentHash - 16-char hex hash of the chunk text
 * @param {string} fields.processingVersion - RAG processing version tag
 * @param {number[]} fields.vector - Float array embedding
 * @param {string} fields.embeddingModelId - Model ID used to generate the vector
 * @returns {object} Complete chunk record ready for MongoDB insertion
 */
export function createKnowledgeChunkRecord({
  chunkId,
  documentId,
  chunkIndex,
  text,
  pageNumber = null,
  title,
  organization,
  documentDate = null,
  category,
  language = 'en',
  sourceUrl = '',
  contentHash,
  processingVersion,
  vector,
  embeddingModelId,
}) {
  const now = new Date().toISOString()
  return {
    chunkId,
    documentId,
    chunkIndex: Number(chunkIndex),
    text: String(text),
    pageNumber: pageNumber !== null && pageNumber !== undefined ? Number(pageNumber) : null,
    title: String(title ?? ''),
    organization: String(organization ?? ''),
    documentDate: documentDate ? String(documentDate) : null,
    category: String(category ?? ''),
    language: String(language),
    sourceUrl: String(sourceUrl ?? ''),
    contentHash: String(contentHash),
    processingVersion: String(processingVersion),
    vector: Array.isArray(vector) ? vector : [],
    embeddingModelId: String(embeddingModelId),
    embeddingDimension: Array.isArray(vector) ? vector.length : 0,
    createdAt: now,
    updatedAt: now,
  }
}
