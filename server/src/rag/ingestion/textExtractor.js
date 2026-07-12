/**
 * Text extractor — Phase 8 RAG ingestion.
 *
 * Routes document bytes to the appropriate format-specific extractor.
 * Currently supported MIME types:
 *   - application/pdf  — via pdf-parse
 *   - text/plain       — raw text decode
 *
 * Every extractor returns:
 *   { text: string, pages: Array<{pageNumber, text}> }
 *
 * Rejected conditions (throws EXTRACTION_ERROR):
 *   - Unsupported MIME type
 *   - Image-only / scanned PDF with no usable text
 *   - Empty extraction result
 *   - Corrupt or unreadable PDF
 *
 * Note: pdf-parse is a CommonJS module; imported via createRequire for ESM compatibility.
 */
import { createRequire } from 'module'
import logger from '../../utils/logger.js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

// Minimum characters for extracted content to be considered usable
const MIN_USABLE_LENGTH = 50

// ── PDF extraction ────────────────────────────────────────────────────────────

/**
 * Extract text from a PDF buffer.
 * Attempts to preserve page numbers using pdf-parse's pageRender callback.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{text: string, pages: Array<{pageNumber: number, text: string}>}>}
 */
async function extractPdf(buffer) {
  // Per-page accumulator built inside the page-render callback
  const pageTexts = []

  const options = {
    // pdf-parse page-render callback: called once per page in order
    pagerender(pageData) {
      return pageData.getTextContent().then((textContent) => {
        const pageText = textContent.items.map((item) => item.str).join(' ')
        pageTexts.push({ pageNumber: pageTexts.length + 1, text: pageText })
        return pageText
      })
    },
  }

  let parsed
  try {
    parsed = await pdfParse(buffer, options)
  } catch (err) {
    logger.error('pdf-parse extraction failed', {
      errorMessage: err.message ?? 'Unknown',
    })
    const appErr = new Error(`PDF extraction failed: ${err.message ?? 'unknown error'}`)
    appErr.code = 'EXTRACTION_ERROR'
    appErr.statusCode = 422
    throw appErr
  }

  const fullText = parsed.text ?? ''

  // Detect image-only PDFs: no usable text extracted
  if (!fullText || fullText.trim().length < MIN_USABLE_LENGTH) {
    const appErr = new Error(
      'PDF appears to contain no usable text content (possible image-only or scanned PDF). ' +
        'Please provide a text-layer PDF or plain text document.'
    )
    appErr.code = 'EXTRACTION_EMPTY'
    appErr.statusCode = 422
    throw appErr
  }

  // If the page callback did not run (rare pdf-parse edge case), fall back to full text
  const pages =
    pageTexts.length > 0
      ? pageTexts.filter((p) => p.text.trim().length > 0)
      : [{ pageNumber: null, text: fullText }]

  logger.debug('PDF extraction complete', {
    totalLength: fullText.length,
    pageCount: pageTexts.length,
  })

  return { text: fullText, pages }
}

// ── Plain text extraction ─────────────────────────────────────────────────────

/**
 * Extract text from a plain text buffer.
 * Decodes as UTF-8 with normalization.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{text: string, pages: Array<{pageNumber: null, text: string}>}>}
 */
async function extractPlainText(buffer) {
  const text = buffer.toString('utf-8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  if (!text || text.trim().length < MIN_USABLE_LENGTH) {
    const appErr = new Error(
      'Plain text document contains no usable content. ' +
        'Please ensure the file is a non-empty UTF-8 text file.'
    )
    appErr.code = 'EXTRACTION_EMPTY'
    appErr.statusCode = 422
    throw appErr
  }

  logger.debug('Plain text extraction complete', { totalLength: text.length })

  return { text, pages: [{ pageNumber: null, text }] }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract text content from a document buffer.
 *
 * @param {Buffer} buffer - Raw file bytes
 * @param {string} mimeType - MIME type of the document
 * @returns {Promise<{text: string, pages: Array<{pageNumber: number|null, text: string}>}>}
 */
export async function extractText(buffer, mimeType) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error('extractText() received an empty or invalid buffer.')
    err.code = 'EXTRACTION_ERROR'
    err.statusCode = 422
    throw err
  }

  switch (mimeType) {
    case 'application/pdf':
      return extractPdf(buffer)

    case 'text/plain':
      return extractPlainText(buffer)

    default: {
      const err = new Error(
        `Unsupported MIME type "${mimeType}" for text extraction. ` +
          'Supported types: application/pdf, text/plain.'
      )
      err.code = 'UNSUPPORTED_MIME_TYPE'
      err.statusCode = 415
      throw err
    }
  }
}
