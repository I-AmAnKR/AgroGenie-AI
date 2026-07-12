/**
 * Scheme eligibility evaluator — Phase 12.
 *
 * Deterministic, safe evaluation of scheme eligibility rules against
 * a normalized FarmerProfile context.
 *
 * Architecture contract:
 *   Input:  { farmerContext, scheme }
 *   Output: {
 *     schemeId,
 *     status,           — eligibility status category (see ELIGIBILITY_STATUS)
 *     matchedRules,     — rules that evaluated true
 *     unmatchedRules,   — rules that evaluated false
 *     unknownRules,     — rules that could not be evaluated (field missing)
 *     missingInformation — fields required but not in farmerContext
 *   }
 *
 * Safety rules:
 *   - NEVER uses eval(), Function(), or dynamic JS execution.
 *   - ONLY supports the operators defined in RULE_OPERATORS (scheme.schema.js).
 *   - Granite/LLM is NOT involved in eligibility calculation.
 *   - The LLM receives the evaluator output and may only explain it.
 *   - Status NEVER reads GUARANTEED_ELIGIBLE or APPROVAL_GUARANTEED.
 */
import { RULE_OPERATORS } from '../models/scheme.schema.js'
import logger from '../utils/logger.js'

// ── Eligibility status categories ─────────────────────────────────────────────

/**
 * Eligibility status values.
 *
 * POTENTIALLY_ELIGIBLE         — All machine-verifiable required rules matched.
 * POTENTIALLY_NOT_ELIGIBLE     — At least one required rule explicitly failed.
 * MORE_INFORMATION_REQUIRED    — Profile is missing fields needed for rule evaluation.
 * RULES_NOT_MACHINE_VERIFIABLE — No machine-readable rules are defined for this scheme.
 * SCHEME_STATUS_UNCERTAIN      — Scheme status is not ACTIVE.
 *
 * Values deliberately avoid any guarantee language.
 */
export const ELIGIBILITY_STATUS = {
  POTENTIALLY_ELIGIBLE: 'POTENTIALLY_ELIGIBLE',
  POTENTIALLY_NOT_ELIGIBLE: 'POTENTIALLY_NOT_ELIGIBLE',
  MORE_INFORMATION_REQUIRED: 'MORE_INFORMATION_REQUIRED',
  RULES_NOT_MACHINE_VERIFIABLE: 'RULES_NOT_MACHINE_VERIFIABLE',
  SCHEME_STATUS_UNCERTAIN: 'SCHEME_STATUS_UNCERTAIN',
}

// ── Field accessor ────────────────────────────────────────────────────────────

/**
 * Safely read a dot-path value from the farmer context.
 *
 * Supported paths (matching normalizeFarmerContext output):
 *   location.state
 *   location.district
 *   farm.area          (numeric or null)
 *   farm.areaUnit
 *   farm.soilType
 *   farm.irrigationType
 *   farm.waterAvailability
 *   cropContext.currentCrop
 *   cropContext.previousCrops  (array)
 *   cropContext.sowingDate
 *   preferences.objective
 *   preferences.language
 *
 * @param {object} farmerContext
 * @param {string} fieldPath - Dot-separated path
 * @returns {{ value: any, exists: boolean }}
 */
function getFieldValue(farmerContext, fieldPath) {
  const parts = fieldPath.split('.')
  let current = farmerContext

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return { value: undefined, exists: false }
    }
    current = current[part]
  }

  const exists = current !== null && current !== undefined
  return { value: current, exists }
}

// ── Operator evaluation ───────────────────────────────────────────────────────

/**
 * Evaluate a single eligibility rule against a field value.
 *
 * @param {object} rule - { field, operator, value, required, explanation }
 * @param {any} fieldValue - Resolved value from farmerContext
 * @param {boolean} fieldExists - Whether the field is present in context
 * @returns {'match' | 'no_match' | 'unknown'} - Rule evaluation outcome
 */
function evaluateOperator(rule, fieldValue, fieldExists) {
  const { operator, value: ruleValue } = rule

  switch (operator) {
    case 'EXISTS':
      return fieldExists ? 'match' : 'no_match'

    case 'NOT_EXISTS':
      return fieldExists ? 'no_match' : 'match'

    case 'EQUALS':
      if (!fieldExists) return 'unknown'
      return String(fieldValue).toLowerCase() === String(ruleValue).toLowerCase() ? 'match' : 'no_match'

    case 'NOT_EQUALS':
      if (!fieldExists) return 'unknown'
      return String(fieldValue).toLowerCase() !== String(ruleValue).toLowerCase() ? 'match' : 'no_match'

    case 'IN': {
      if (!fieldExists) return 'unknown'
      if (!Array.isArray(ruleValue)) return 'unknown'
      const normField = String(fieldValue).toLowerCase()
      return ruleValue.some((v) => String(v).toLowerCase() === normField) ? 'match' : 'no_match'
    }

    case 'NOT_IN': {
      if (!fieldExists) return 'unknown'
      if (!Array.isArray(ruleValue)) return 'unknown'
      const normField2 = String(fieldValue).toLowerCase()
      return ruleValue.every((v) => String(v).toLowerCase() !== normField2) ? 'match' : 'no_match'
    }

    case 'GREATER_THAN': {
      if (!fieldExists) return 'unknown'
      const n = parseFloat(fieldValue)
      if (isNaN(n)) return 'unknown'
      return n > parseFloat(ruleValue) ? 'match' : 'no_match'
    }

    case 'GREATER_THAN_OR_EQUAL': {
      if (!fieldExists) return 'unknown'
      const n2 = parseFloat(fieldValue)
      if (isNaN(n2)) return 'unknown'
      return n2 >= parseFloat(ruleValue) ? 'match' : 'no_match'
    }

    case 'LESS_THAN': {
      if (!fieldExists) return 'unknown'
      const n3 = parseFloat(fieldValue)
      if (isNaN(n3)) return 'unknown'
      return n3 < parseFloat(ruleValue) ? 'match' : 'no_match'
    }

    case 'LESS_THAN_OR_EQUAL': {
      if (!fieldExists) return 'unknown'
      const n4 = parseFloat(fieldValue)
      if (isNaN(n4)) return 'unknown'
      return n4 <= parseFloat(ruleValue) ? 'match' : 'no_match'
    }

    case 'BETWEEN': {
      if (!fieldExists) return 'unknown'
      if (!Array.isArray(ruleValue) || ruleValue.length !== 2) return 'unknown'
      const n5 = parseFloat(fieldValue)
      if (isNaN(n5)) return 'unknown'
      return n5 >= parseFloat(ruleValue[0]) && n5 <= parseFloat(ruleValue[1]) ? 'match' : 'no_match'
    }

    case 'CONTAINS': {
      if (!fieldExists) return 'unknown'
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((item) =>
          String(item).toLowerCase().includes(String(ruleValue).toLowerCase())
        ) ? 'match' : 'no_match'
      }
      return String(fieldValue).toLowerCase().includes(String(ruleValue).toLowerCase()) ? 'match' : 'no_match'
    }

    default:
      // Unknown operator — treat as non-machine-verifiable
      logger.warn('SchemeEligibility: unknown operator', { operator })
      return 'unknown'
  }
}

// ── Main evaluator ────────────────────────────────────────────────────────────

/**
 * Evaluate all eligibility rules for a scheme against farmer context.
 *
 * @param {object} params
 * @param {object} params.farmerContext - Normalized farmer context
 * @param {object} params.scheme - Scheme record from repository
 * @returns {object} Eligibility evaluation result
 */
export function evaluateEligibility({ farmerContext, scheme }) {
  if (!scheme) {
    return {
      schemeId: null,
      status: ELIGIBILITY_STATUS.RULES_NOT_MACHINE_VERIFIABLE,
      matchedRules: [],
      unmatchedRules: [],
      unknownRules: [],
      missingInformation: [],
    }
  }

  // Scheme status check — uncertain if not ACTIVE
  if (scheme.status !== 'ACTIVE') {
    return {
      schemeId: scheme.schemeId,
      status: ELIGIBILITY_STATUS.SCHEME_STATUS_UNCERTAIN,
      matchedRules: [],
      unmatchedRules: [],
      unknownRules: [],
      missingInformation: [],
    }
  }

  const rules = scheme.eligibilityRules ?? []

  // No machine-readable rules defined
  if (rules.length === 0) {
    return {
      schemeId: scheme.schemeId,
      status: ELIGIBILITY_STATUS.RULES_NOT_MACHINE_VERIFIABLE,
      matchedRules: [],
      unmatchedRules: [],
      unknownRules: [],
      missingInformation: [],
    }
  }

  const matchedRules = []
  const unmatchedRules = []
  const unknownRules = []
  const missingFields = new Set()

  for (const rule of rules) {
    // Validate the operator before evaluation — reject unknown operators
    if (!RULE_OPERATORS.includes(rule.operator)) {
      unknownRules.push({
        field: rule.field,
        explanation: `Operator "${rule.operator}" is not supported by the evaluator.`,
      })
      continue
    }

    const { value: fieldValue, exists: fieldExists } = getFieldValue(farmerContext, rule.field)
    const outcome = evaluateOperator(rule, fieldValue, fieldExists)

    if (outcome === 'match') {
      matchedRules.push({
        field: rule.field,
        explanation: rule.explanation ?? `Condition for "${rule.field}" appears satisfied.`,
      })
    } else if (outcome === 'no_match') {
      if (rule.required !== false) {
        // required defaults to true
        unmatchedRules.push({
          field: rule.field,
          explanation: rule.explanation ?? `Condition for "${rule.field}" was not met.`,
        })
      }
      // Non-required unmatched rules are informational only — not counted as a block
    } else {
      // unknown outcome (missing field or unsupported operator)
      unknownRules.push({
        field: rule.field,
        explanation:
          rule.explanation ??
          `The profile does not contain "${rule.field}" — this condition could not be verified.`,
      })
      if (!fieldExists && !['EXISTS', 'NOT_EXISTS'].includes(rule.operator)) {
        missingFields.add(rule.field)
      }
    }
  }

  // Determine overall eligibility status
  let status

  if (unmatchedRules.length > 0) {
    // At least one required condition explicitly failed
    status = ELIGIBILITY_STATUS.POTENTIALLY_NOT_ELIGIBLE
  } else if (missingFields.size > 0) {
    // No failures but missing information prevents complete evaluation
    status = ELIGIBILITY_STATUS.MORE_INFORMATION_REQUIRED
  } else if (matchedRules.length > 0 && unknownRules.length === 0) {
    // All rules matched, no unknowns
    status = ELIGIBILITY_STATUS.POTENTIALLY_ELIGIBLE
  } else if (unknownRules.length > 0 && unmatchedRules.length === 0) {
    // Some rules could not be evaluated (non-machine-verifiable conditions)
    status = ELIGIBILITY_STATUS.MORE_INFORMATION_REQUIRED
  } else {
    status = ELIGIBILITY_STATUS.RULES_NOT_MACHINE_VERIFIABLE
  }

  return {
    schemeId: scheme.schemeId,
    status,
    matchedRules,
    unmatchedRules,
    unknownRules,
    missingInformation: Array.from(missingFields),
  }
}
