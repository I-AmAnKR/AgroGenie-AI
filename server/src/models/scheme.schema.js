/**
 * Scheme model schema — Phase 12.
 *
 * Plain JS factory + validation functions (no Mongoose).
 * Consistent with the knowledgeDocument.schema.js pattern (Phase 7).
 *
 * MongoDB stores scheme METADATA only.
 *
 * Scheme levels:
 *   CENTRAL  — central government scheme
 *   STATE    — state-level scheme
 *   DISTRICT — district-level scheme
 *   OTHER    — unclassified
 *
 * Status values:
 *   ACTIVE        — scheme is currently operational
 *   INACTIVE      — scheme has ended or been suspended
 *   UNKNOWN       — status could not be determined
 *   NEEDS_REVIEW  — record requires fresh verification
 *
 * Data integrity rules:
 *   - Never invent benefit amounts, deadlines, documents, or URLs.
 *   - lastVerifiedAt tracks when the record was last confirmed against
 *     an official source.
 *   - isDemo: true on all curated/seed records until individually
 *     verified against an official real-time source.
 */
import { v4 as uuidv4 } from 'uuid'

// ── Allowed values ────────────────────────────────────────────────────────────

export const SCHEME_LEVELS = ['CENTRAL', 'STATE', 'DISTRICT', 'OTHER']

export const SCHEME_STATUSES = ['ACTIVE', 'INACTIVE', 'UNKNOWN', 'NEEDS_REVIEW']

export const APPLICATION_MODES = ['ONLINE', 'OFFLINE', 'BOTH', 'UNKNOWN']

/**
 * Supported eligibility rule operators.
 * These are the ONLY operators the deterministic evaluator supports.
 * No eval(), no arbitrary JS execution.
 */
export const RULE_OPERATORS = [
  'EQUALS',
  'NOT_EQUALS',
  'IN',
  'NOT_IN',
  'GREATER_THAN',
  'GREATER_THAN_OR_EQUAL',
  'LESS_THAN',
  'LESS_THAN_OR_EQUAL',
  'BETWEEN',
  'EXISTS',
  'NOT_EXISTS',
  'CONTAINS',
]

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a new Scheme record object.
 * Does NOT insert into MongoDB — caller must do that via the repository.
 *
 * @param {object} fields
 * @returns {object} Complete scheme record ready for MongoDB insertion
 */
export function createSchemeRecord({
  schemeCode,
  name,
  shortName = '',
  description = '',
  schemeLevel = 'CENTRAL',
  ministry = '',
  department = '',
  applicableStates = [],
  applicableDistricts = [],
  targetBeneficiaries = [],
  categories = [],
  benefitsSummary = '',
  officialSourceUrl = '',
  applicationUrl = '',
  applicationMode = 'UNKNOWN',
  validFrom = null,
  validUntil = null,
  status = 'UNKNOWN',
  lastVerifiedAt = null,
  verificationNotes = '',
  sourceDocumentIds = [],
  eligibilityRules = [],
  requiredDocuments = [],
  applicationSteps = [],
  tags = [],
  isDemo = true,
}) {
  const now = new Date().toISOString()

  // Validate schemeLevel
  const level = SCHEME_LEVELS.includes(schemeLevel) ? schemeLevel : 'CENTRAL'
  // Validate status
  const schemeStatus = SCHEME_STATUSES.includes(status) ? status : 'UNKNOWN'
  // Validate applicationMode
  const appMode = APPLICATION_MODES.includes(applicationMode) ? applicationMode : 'UNKNOWN'

  return {
    schemeId: uuidv4(),
    schemeCode: String(schemeCode ?? '').trim(),
    name: String(name ?? '').trim().slice(0, 500),
    shortName: String(shortName ?? '').trim().slice(0, 100),
    description: String(description ?? '').trim().slice(0, 2000),
    schemeLevel: level,
    ministry: String(ministry ?? '').trim().slice(0, 255),
    department: String(department ?? '').trim().slice(0, 255),
    applicableStates: Array.isArray(applicableStates)
      ? applicableStates.map((s) => String(s).trim()).filter(Boolean)
      : [],
    applicableDistricts: Array.isArray(applicableDistricts)
      ? applicableDistricts.map((d) => String(d).trim()).filter(Boolean)
      : [],
    targetBeneficiaries: Array.isArray(targetBeneficiaries)
      ? targetBeneficiaries.map((b) => String(b).trim()).filter(Boolean)
      : [],
    categories: Array.isArray(categories)
      ? categories.map((c) => String(c).trim().toLowerCase()).filter(Boolean)
      : [],
    benefitsSummary: String(benefitsSummary ?? '').trim().slice(0, 1000),
    officialSourceUrl: String(officialSourceUrl ?? '').trim().slice(0, 2048),
    applicationUrl: String(applicationUrl ?? '').trim().slice(0, 2048),
    applicationMode: appMode,
    validFrom: validFrom ? String(validFrom) : null,
    validUntil: validUntil ? String(validUntil) : null,
    status: schemeStatus,
    lastVerifiedAt: lastVerifiedAt ? String(lastVerifiedAt) : null,
    verificationNotes: String(verificationNotes ?? '').trim().slice(0, 1000),
    sourceDocumentIds: Array.isArray(sourceDocumentIds)
      ? sourceDocumentIds.map((id) => String(id).trim()).filter(Boolean)
      : [],
    // eligibilityRules: array of { field, operator, value, required, explanation }
    eligibilityRules: Array.isArray(eligibilityRules) ? eligibilityRules : [],
    // requiredDocuments: array of { name, requiredStatus, condition }
    requiredDocuments: Array.isArray(requiredDocuments) ? requiredDocuments : [],
    // applicationSteps: array of { order, description }
    applicationSteps: Array.isArray(applicationSteps) ? applicationSteps : [],
    tags: Array.isArray(tags)
      ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
      : [],
    // isDemo: true on curated/seed records until officially verified
    isDemo: Boolean(isDemo),
    createdAt: now,
    updatedAt: now,
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a scheme record before persistence.
 * Returns an array of validation error messages.
 * Empty array means valid.
 *
 * @param {object} record
 * @returns {string[]} Validation errors
 */
export function validateSchemeRecord(record) {
  const errors = []

  if (!record.name || !record.name.trim()) {
    errors.push('name is required')
  }
  if (!record.schemeCode || !record.schemeCode.trim()) {
    errors.push('schemeCode is required')
  }
  if (!SCHEME_LEVELS.includes(record.schemeLevel)) {
    errors.push(`schemeLevel must be one of: ${SCHEME_LEVELS.join(', ')}`)
  }
  if (!SCHEME_STATUSES.includes(record.status)) {
    errors.push(`status must be one of: ${SCHEME_STATUSES.join(', ')}`)
  }

  // Validate eligibility rules structure
  for (const rule of record.eligibilityRules ?? []) {
    if (!rule.field) errors.push('eligibilityRule missing field')
    if (!RULE_OPERATORS.includes(rule.operator)) {
      errors.push(`eligibilityRule operator "${rule.operator}" is not supported`)
    }
  }

  return errors
}
