/**
 * KnowledgeDocument schema — Phase 7.
 *
 * Plain JS factory + validation functions (no Mongoose).
 * Consistent with Phase 5 raw MongoDB driver approach.
 *
 * MongoDB stores document METADATA only.
 * Actual file bytes are stored in IBM COS.
 *
 * Status values:
 *   active            — document is live and usable
 *   archived          — document is retained but not active
 *   deleted           — soft-deleted (not returned in normal queries)
 *
 * Processing status values:
 *   uploaded          — file received, no processing done
 *   pending_processing — queued for Phase 8 RAG pipeline
 *   processed         — text extracted, chunked, and indexed
 *   failed            — processing encountered an error
 */
import { v4 as uuidv4 } from 'uuid'

// ── Allowed values ────────────────────────────────────────────────────────────

export const ALLOWED_CATEGORIES = [
  'knowledge/crop-guides',
  'knowledge/pest-management',
  'knowledge/soil-management',
  'knowledge/irrigation',
  'knowledge/government-schemes',
  'knowledge/general',
]

export const ALLOWED_MIME_TYPES = ['application/pdf', 'text/plain']

export const ALLOWED_STATUSES = ['active', 'archived', 'deleted']

export const ALLOWED_PROCESSING_STATUSES = [
  'uploaded',
  'pending_processing',
  'processed',
  'failed',
]

export const ALLOWED_LANGUAGES = ['en', 'hi', 'pa', 'mr', 'te', 'ta', 'kn', 'gu', 'bn', 'or']

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a new KnowledgeDocument record object.
 * Does NOT insert into MongoDB — caller must do that via the repository.
 *
 * @param {object} fields
 * @returns {object} Complete document record ready for MongoDB insertion
 */
export function createKnowledgeDocumentRecord({
  originalName,
  objectKey,
  bucketName,
  mimeType,
  sizeBytes,
  category,
  title,
  organization = '',
  documentDate = null,
  language = 'en',
  tags = [],
  sourceUrl = '',
  uploadedBy = 'anonymous',
  storageProvider = 'cos',
  checksum = null,
}) {
  const now = new Date().toISOString()
  return {
    documentId: uuidv4(),
    originalName: String(originalName).slice(0, 255),
    objectKey: String(objectKey),
    bucketName: String(bucketName),
    mimeType: String(mimeType),
    sizeBytes: Number(sizeBytes),
    category: String(category),
    title: String(title).slice(0, 500),
    organization: String(organization).slice(0, 255),
    documentDate: documentDate ? String(documentDate) : null,
    language: String(language),
    tags: Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean) : [],
    sourceUrl: String(sourceUrl).slice(0, 2048),
    uploadedBy: String(uploadedBy),
    storageProvider: String(storageProvider),
    status: 'active',
    processingStatus: 'pending_processing', // Phase 8 will advance this
    checksum: checksum ? String(checksum) : null,
    createdAt: now,
    updatedAt: now,
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate upload fields from an HTTP request.
 * Returns an array of validation error messages.
 * Empty array means valid.
 *
 * @param {object} fields - Fields from req.body / req.file
 * @returns {string[]} Validation errors
 */
export function validateUploadFields({ file, category, title, organization }) {
  const errors = []

  if (!file) {
    errors.push('file is required')
  } else {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      errors.push(
        `Unsupported file type "${file.mimetype}". Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
      )
    }
  }

  if (!category || !category.trim()) {
    errors.push('category is required')
  } else if (!ALLOWED_CATEGORIES.includes(category.trim())) {
    errors.push(
      `Invalid category "${category}". Allowed: ${ALLOWED_CATEGORIES.join(', ')}`
    )
  }

  if (!title || !String(title).trim()) {
    errors.push('title is required')
  }

  if (!organization || !String(organization).trim()) {
    errors.push('organization is required')
  }

  return errors
}
