/**
 * Text chunker — Phase 8 RAG ingestion.
 *
 * Splits cleaned text into overlapping chunks for embedding.
 *
 * Chunking strategy:
 *   - Character-based sliding window with configurable size and overlap.
 *   - Chunk boundaries are aligned to word boundaries where possible
 *     (breaks at the nearest whitespace before the chunk boundary).
 *   - Overlap creates a shared context window between adjacent chunks.
 *   - Every chunk retains full source metadata.
 *
 * Approximation note:
 *   Chunk size is in characters, not tokens. For Slate 125M (seq limit ~512 tokens),
 *   800 characters ≈ 150-200 tokens — a safe approximation for English/Hindi text.
 *   Token-aware splitting would require a tokenizer library not included in this stack.
 *   The default chunk size is conservative to stay well within model limits.
 *
 * Chunk ID scheme:
 *   {documentId}-chunk-{chunkIndex}
 *   Deterministic: same document + config = same chunk IDs.
 *   Content hash is stored separately for change detection.
 *
 * Page tracking:
 *   When page-level text is available, each chunk is assigned the page number
 *   of the page that contains the majority of its text.
 */
import { createHash } from 'crypto'
import config from '../../config/env.js'

/**
 * Generate a content hash for a chunk.
 * Used for change detection during reprocessing.
 *
 * @param {string} text
 * @returns {string} 8-character hex hash
 */
function contentHash(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)
}

/**
 * Find the position of the nearest word boundary before `pos`.
 * If no space found within `lookBack` chars, returns `pos` (hard break).
 *
 * @param {string} text
 * @param {number} pos - Target position
 * @param {number} [lookBack=100] - How far back to look for a space
 * @returns {number} Adjusted break position
 */
function wordBoundaryBefore(text, pos, lookBack = 100) {
  if (pos >= text.length) return text.length
  const start = Math.max(0, pos - lookBack)
  const sub = text.slice(start, pos)
  const lastSpace = sub.lastIndexOf(' ')
  if (lastSpace === -1) return pos // hard break
  return start + lastSpace + 1
}

/**
 * Split text into overlapping character-window chunks aligned to word boundaries.
 *
 * @param {string} text - Full document text
 * @param {number} chunkSize - Target chunk size in characters
 * @param {number} chunkOverlap - Overlap between adjacent chunks in characters
 * @returns {Array<{start: number, end: number, text: string}>}
 */
function splitIntoWindows(text, chunkSize, chunkOverlap) {
  if (chunkSize <= 0 || chunkOverlap >= chunkSize) {
    throw new Error(`Invalid chunk config: size=${chunkSize}, overlap=${chunkOverlap}`)
  }

  const chunks = []
  let start = 0
  const len = text.length

  while (start < len) {
    const rawEnd = start + chunkSize
    const end = wordBoundaryBefore(text, rawEnd)
    const chunkText = text.slice(start, end).trim()

    if (chunkText.length > 0) {
      chunks.push({ start, end, text: chunkText })
    }

    // Advance by (chunkSize - overlap), aligned to word boundary
    const rawNextStart = start + chunkSize - chunkOverlap
    const nextStart = wordBoundaryBefore(text, rawNextStart)
    start = nextStart

    // Safety: ensure we always advance to avoid infinite loop
    if (start <= chunks[chunks.length - 1]?.start) {
      start = end
    }
    if (start >= len) break
  }

  return chunks
}

/**
 * Build page index: array of { pageNumber, endPos } sorted by endPos.
 * Used to assign page numbers to chunks based on position in the full text.
 *
 * @param {Array<{pageNumber: number|null, text: string}>} pages
 * @returns {Array<{pageNumber: number|null, endPos: number}>}
 */
function buildPageIndex(pages) {
  const index = []
  let pos = 0
  for (const page of pages) {
    pos += page.text.length
    index.push({ pageNumber: page.pageNumber, endPos: pos })
  }
  return index
}

/**
 * Find the page number for a chunk that starts at `chunkStart`.
 *
 * @param {Array<{pageNumber: number|null, endPos: number}>} pageIndex
 * @param {number} chunkStart
 * @returns {number|null}
 */
function pageForChunk(pageIndex, chunkStart) {
  if (!pageIndex || pageIndex.length === 0) return null
  for (const entry of pageIndex) {
    if (chunkStart < entry.endPos) return entry.pageNumber
  }
  return pageIndex[pageIndex.length - 1]?.pageNumber ?? null
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create chunks from a document with full source metadata.
 *
 * @param {object} params
 * @param {string} params.documentId - Document UUID
 * @param {string} params.text - Full cleaned document text
 * @param {Array<{pageNumber: number|null, text: string}>} [params.pages=[]] - Page-level text
 * @param {object} params.docMeta - Document metadata from KnowledgeDocument record
 * @param {string} [params.processingVersion] - RAG processing version tag
 * @returns {Array<object>} Array of chunk objects ready for vector store upsert
 */
export function createChunks({
  documentId,
  text,
  pages = [],
  docMeta,
  processingVersion,
}) {
  const chunkSize = config.rag.chunkSize
  const chunkOverlap = config.rag.chunkOverlap
  const version = processingVersion ?? config.rag.processingVersion

  const windows = splitIntoWindows(text, chunkSize, chunkOverlap)
  const pageIndex = buildPageIndex(pages)

  return windows.map((win, idx) => {
    const chunkId = `${documentId}-chunk-${idx}`
    const pageNumber = pageForChunk(pageIndex, win.start)

    return {
      chunkId,
      documentId,
      chunkIndex: idx,
      text: win.text,
      pageNumber,
      // Source metadata copied from the document record
      title: docMeta.title ?? '',
      organization: docMeta.organization ?? '',
      documentDate: docMeta.documentDate ?? null,
      category: docMeta.category ?? '',
      language: docMeta.language ?? 'en',
      sourceUrl: docMeta.sourceUrl ?? '',
      // Technical metadata
      contentHash: contentHash(win.text),
      processingVersion: version,
      createdAt: new Date().toISOString(),
    }
  })
}
