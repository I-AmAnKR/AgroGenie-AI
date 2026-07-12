/**
 * Text cleaner — Phase 8 RAG ingestion.
 *
 * Applies deterministic normalisation to extracted text.
 *
 * Design principles:
 * - Preserve meaningful content (crop names, units, numbers, headings).
 * - Remove obvious extraction artifacts.
 * - Normalize whitespace and line endings.
 * - Preserve paragraph boundaries.
 * - Do NOT translate or rewrite source content.
 * - Do NOT use AI to clean text before indexing.
 *
 * The indexed chunks remain faithful to source content.
 */

/**
 * Clean and normalize extracted text for chunking.
 *
 * Steps applied (in order):
 * 1. Normalize Windows/Mac line endings to LF
 * 2. Remove common PDF extraction artifacts (form feed chars, null bytes)
 * 3. Collapse sequences of 3+ blank lines to exactly 2 (preserves paragraphs)
 * 4. Normalize repeated whitespace within lines (but preserve line breaks)
 * 5. Remove leading/trailing whitespace from each line
 * 6. Trim the overall text
 *
 * @param {string} text - Raw extracted text
 * @returns {string} Cleaned text
 */
export function cleanText(text) {
  if (typeof text !== 'string') return ''

  let t = text

  // 1. Normalize line endings
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 2. Remove PDF extraction artifacts
  t = t.replace(/\f/g, '\n')        // form feed → newline
  t = t.replace(/\0/g, '')           // null bytes
  t = t.replace(/\ufffd/g, '')       // replacement characters from bad encoding
  t = t.replace(/[ \t]+$/gm, '')     // trailing whitespace on lines (but not newlines)

  // 3. Remove sequences of 3+ blank lines → exactly 2 blank lines (paragraph boundary)
  t = t.replace(/\n{3,}/g, '\n\n')

  // 4. Normalize repeated horizontal whitespace within lines
  //    Spaces and tabs within a line → single space
  //    Use character class to avoid collapsing newlines
  t = t.replace(/[^\S\n]+/g, ' ')

  // 5. Trim each line
  t = t.split('\n').map((line) => line.trim()).join('\n')

  // 6. Final trim
  t = t.trim()

  return t
}

/**
 * Clean text extracted from individual pages.
 * Applies cleanText() to each page's text and filters empty pages.
 *
 * @param {Array<{pageNumber: number|null, text: string}>} pages
 * @returns {Array<{pageNumber: number|null, text: string}>}
 */
export function cleanPages(pages) {
  return pages
    .map((page) => ({
      ...page,
      text: cleanText(page.text),
    }))
    .filter((page) => page.text.length > 0)
}
