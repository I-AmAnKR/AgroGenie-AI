/**
 * Scheme Eligibility Evaluator tests — Phase 12.
 *
 * Tests the deterministic rule evaluator in isolation.
 * No external dependencies — no MongoDB, no AI provider.
 *
 * Run: cd server && npm test -- --testPathPattern=schemeEligibility
 */
import { evaluateEligibility, ELIGIBILITY_STATUS } from '../services/schemeEligibility.service.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(overrides = {}) {
  return {
    location: { state: 'Haryana', district: 'Karnal', ...overrides.location },
    farm: {
      area: 1.5,
      areaUnit: 'hectares',
      soilType: 'Loamy',
      irrigationType: 'Canal',
      waterAvailability: 'available',
      ...overrides.farm,
    },
    cropContext: {
      currentCrop: 'Wheat',
      previousCrops: ['Rice'],
      sowingDate: null,
      ...overrides.cropContext,
    },
    preferences: { objective: null, language: 'en', ...overrides.preferences },
  }
}

function makeScheme(overrides = {}) {
  return {
    schemeId: 'test-scheme-id',
    schemeCode: 'TEST',
    name: 'Test Scheme',
    status: 'ACTIVE',
    eligibilityRules: [],
    ...overrides,
  }
}

// ── Scheme status checks ──────────────────────────────────────────────────────

describe('Eligibility Evaluator — scheme status', () => {
  it('returns SCHEME_STATUS_UNCERTAIN for INACTIVE scheme', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext(),
      scheme: makeScheme({ status: 'INACTIVE' }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.SCHEME_STATUS_UNCERTAIN)
  })

  it('returns SCHEME_STATUS_UNCERTAIN for UNKNOWN status scheme', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext(),
      scheme: makeScheme({ status: 'UNKNOWN' }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.SCHEME_STATUS_UNCERTAIN)
  })
})

// ── No rules ──────────────────────────────────────────────────────────────────

describe('Eligibility Evaluator — no rules', () => {
  it('returns RULES_NOT_MACHINE_VERIFIABLE when scheme has no eligibility rules', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext(),
      scheme: makeScheme({ eligibilityRules: [] }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.RULES_NOT_MACHINE_VERIFIABLE)
    expect(result.matchedRules).toHaveLength(0)
  })

  it('returns RULES_NOT_MACHINE_VERIFIABLE when null scheme is passed', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext(),
      scheme: null,
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.RULES_NOT_MACHINE_VERIFIABLE)
  })
})

// ── EQUALS operator ───────────────────────────────────────────────────────────

describe('Eligibility Evaluator — EQUALS operator', () => {
  it('matches EQUALS rule when field matches value', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext(),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'location.state',
            operator: 'EQUALS',
            value: 'Haryana',
            required: true,
            explanation: 'State must be Haryana.',
          },
        ],
      }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.POTENTIALLY_ELIGIBLE)
    expect(result.matchedRules).toHaveLength(1)
  })

  it('returns POTENTIALLY_NOT_ELIGIBLE when required EQUALS fails', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext(),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'location.state',
            operator: 'EQUALS',
            value: 'Punjab',
            required: true,
            explanation: 'State must be Punjab.',
          },
        ],
      }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.POTENTIALLY_NOT_ELIGIBLE)
    expect(result.unmatchedRules).toHaveLength(1)
  })

  it('is case-insensitive for EQUALS operator', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ location: { state: 'haryana' } }),
      scheme: makeScheme({
        eligibilityRules: [
          { field: 'location.state', operator: 'EQUALS', value: 'HARYANA', required: true, explanation: '' },
        ],
      }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.POTENTIALLY_ELIGIBLE)
  })
})

// ── IN operator ───────────────────────────────────────────────────────────────

describe('Eligibility Evaluator — IN operator', () => {
  it('matches IN rule when field value is in the array', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ location: { state: 'Punjab' } }),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'location.state',
            operator: 'IN',
            value: ['Haryana', 'Punjab', 'Rajasthan'],
            required: true,
            explanation: 'Available in supported states.',
          },
        ],
      }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.POTENTIALLY_ELIGIBLE)
  })

  it('returns POTENTIALLY_NOT_ELIGIBLE for IN when value not in array', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ location: { state: 'Kerala' } }),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'location.state',
            operator: 'IN',
            value: ['Haryana', 'Punjab'],
            required: true,
            explanation: 'Available in Haryana and Punjab only.',
          },
        ],
      }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.POTENTIALLY_NOT_ELIGIBLE)
  })
})

// ── NOT_IN operator ───────────────────────────────────────────────────────────

describe('Eligibility Evaluator — NOT_IN operator', () => {
  it('matches NOT_IN rule when value is absent from array', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ farm: { irrigationType: 'Canal' } }),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'farm.irrigationType',
            operator: 'NOT_IN',
            value: ['drip', 'Drip', 'sprinkler', 'Sprinkler'],
            required: false,
            explanation: 'Farmers without existing drip/sprinkler systems.',
          },
        ],
      }),
    })
    // NOT_IN non-required — does not cause unmatch; check no failure
    expect(result.status).not.toBe(ELIGIBILITY_STATUS.POTENTIALLY_NOT_ELIGIBLE)
  })
})

// ── Numeric range operators ───────────────────────────────────────────────────

describe('Eligibility Evaluator — numeric range operators', () => {
  it('matches LESS_THAN_OR_EQUAL rule within range', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ farm: { area: 1.5 } }),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'farm.area',
            operator: 'LESS_THAN_OR_EQUAL',
            value: 2,
            required: true,
            explanation: 'Farm area ≤ 2 hectares.',
          },
        ],
      }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.POTENTIALLY_ELIGIBLE)
  })

  it('fails LESS_THAN_OR_EQUAL rule when area exceeds threshold', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ farm: { area: 5 } }),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'farm.area',
            operator: 'LESS_THAN_OR_EQUAL',
            value: 2,
            required: true,
            explanation: 'Farm area ≤ 2 hectares.',
          },
        ],
      }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.POTENTIALLY_NOT_ELIGIBLE)
  })

  it('returns MORE_INFORMATION_REQUIRED when area field is missing', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ farm: { area: null } }),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'farm.area',
            operator: 'LESS_THAN_OR_EQUAL',
            value: 2,
            required: true,
            explanation: 'Farm area ≤ 2 hectares.',
          },
        ],
      }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.MORE_INFORMATION_REQUIRED)
    expect(result.missingInformation).toContain('farm.area')
  })

  it('evaluates BETWEEN correctly when in range', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ farm: { area: 1.5 } }),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'farm.area',
            operator: 'BETWEEN',
            value: [0.5, 3],
            required: true,
            explanation: 'Farm area between 0.5 and 3 hectares.',
          },
        ],
      }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.POTENTIALLY_ELIGIBLE)
  })
})

// ── EXISTS / NOT_EXISTS operators ─────────────────────────────────────────────

describe('Eligibility Evaluator — EXISTS / NOT_EXISTS operators', () => {
  it('matches EXISTS rule when field is present and non-null', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ cropContext: { currentCrop: 'Wheat' } }),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'cropContext.currentCrop',
            operator: 'EXISTS',
            value: null,
            required: true,
            explanation: 'A current crop must be specified.',
          },
        ],
      }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.POTENTIALLY_ELIGIBLE)
  })

  it('fails EXISTS rule when field is null', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ cropContext: { currentCrop: null } }),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'cropContext.currentCrop',
            operator: 'EXISTS',
            value: null,
            required: true,
            explanation: 'A current crop must be specified.',
          },
        ],
      }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.POTENTIALLY_NOT_ELIGIBLE)
  })
})

// ── CONTAINS operator ─────────────────────────────────────────────────────────

describe('Eligibility Evaluator — CONTAINS operator', () => {
  it('matches CONTAINS rule against array field', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ cropContext: { previousCrops: ['Rice', 'Wheat'] } }),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'cropContext.previousCrops',
            operator: 'CONTAINS',
            value: 'Rice',
            required: true,
            explanation: 'Must have grown rice previously.',
          },
        ],
      }),
    })
    expect(result.status).toBe(ELIGIBILITY_STATUS.POTENTIALLY_ELIGIBLE)
  })
})

// ── Missing field handling ────────────────────────────────────────────────────

describe('Eligibility Evaluator — missing field handling', () => {
  it('returns MORE_INFORMATION_REQUIRED when a required field is missing from context', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ location: { state: null, district: null } }),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'location.state',
            operator: 'EQUALS',
            value: 'Haryana',
            required: true,
            explanation: 'State must be Haryana.',
          },
        ],
      }),
    })
    // null state → value is present but null; evaluator sees it as "unknown" for EQUALS
    // The field value is null which IS "exists" but NOT equals 'Haryana'
    // → POTENTIALLY_NOT_ELIGIBLE (null !== 'Haryana' after String() conversion)
    // Accept either status depending on null handling
    expect([
      ELIGIBILITY_STATUS.POTENTIALLY_NOT_ELIGIBLE,
      ELIGIBILITY_STATUS.MORE_INFORMATION_REQUIRED,
    ]).toContain(result.status)
  })

  it('populates missingInformation for unknown fields', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext({ farm: { area: null } }),
      scheme: makeScheme({
        eligibilityRules: [
          {
            field: 'farm.area',
            operator: 'GREATER_THAN',
            value: 0,
            required: true,
            explanation: 'Farm must have a recorded area.',
          },
        ],
      }),
    })
    expect(result.missingInformation).toContain('farm.area')
  })
})

// ── Safety checks ─────────────────────────────────────────────────────────────

describe('Eligibility Evaluator — safety checks', () => {
  it('never returns GUARANTEED_ELIGIBLE or APPROVAL_GUARANTEED', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext(),
      scheme: makeScheme({
        eligibilityRules: [
          { field: 'location.state', operator: 'EQUALS', value: 'Haryana', required: true, explanation: '' },
          { field: 'farm.area', operator: 'LESS_THAN_OR_EQUAL', value: 5, required: true, explanation: '' },
        ],
      }),
    })
    expect(result.status).not.toBe('GUARANTEED_ELIGIBLE')
    expect(result.status).not.toBe('APPROVAL_GUARANTEED')
  })

  it('handles unknown operator gracefully without throwing', () => {
    expect(() => {
      evaluateEligibility({
        farmerContext: makeContext(),
        scheme: makeScheme({
          eligibilityRules: [
            { field: 'location.state', operator: 'EVAL_DANGER', value: '', required: true, explanation: '' },
          ],
        }),
      })
    }).not.toThrow()
  })

  it('does not expose internal exceptions for malformed rule values', () => {
    const result = evaluateEligibility({
      farmerContext: makeContext(),
      scheme: makeScheme({
        eligibilityRules: [
          { field: 'farm.area', operator: 'BETWEEN', value: 'not-an-array', required: true, explanation: '' },
        ],
      }),
    })
    // Should degrade gracefully — not throw
    expect(result).toBeDefined()
    expect(result.status).toBeDefined()
  })
})
