/**
 * Agent Result normalization tests — Phase 9.
 *
 * Run: cd server && npm test -- --testPathPattern=agents/agentResult
 */
import { createAgentResult, normalizeAgentResult, validateAgentResult } from './agentResult.js'
import { INTENT, RESULT_STATUS } from './intents.js'

describe('createAgentResult', () => {
  it('creates a result with all required fields', () => {
    const result = createAgentResult()
    expect(result).toHaveProperty('intent')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('answer')
    expect(result).toHaveProperty('agentsUsed')
    expect(result).toHaveProperty('sources')
    expect(result).toHaveProperty('grounded')
    expect(result).toHaveProperty('missingInformation')
    expect(result).toHaveProperty('warnings')
    expect(result).toHaveProperty('provider')
    expect(result).toHaveProperty('model')
    expect(result).toHaveProperty('retrieval')
    expect(result).toHaveProperty('isDemo')
  })

  it('merges overrides correctly', () => {
    const result = createAgentResult({ intent: INTENT.KNOWLEDGE, grounded: true })
    expect(result.intent).toBe(INTENT.KNOWLEDGE)
    expect(result.grounded).toBe(true)
  })

  it('sources defaults to empty array', () => {
    const result = createAgentResult()
    expect(result.sources).toEqual([])
  })

  it('isDemo defaults to false', () => {
    const result = createAgentResult()
    expect(result.isDemo).toBe(false)
  })
})

describe('normalizeAgentResult', () => {
  it('fills in defaults for missing fields', () => {
    const result = normalizeAgentResult({ intent: INTENT.GENERAL, answer: 'hi' })
    expect(Array.isArray(result.sources)).toBe(true)
    expect(Array.isArray(result.agentsUsed)).toBe(true)
    expect(Array.isArray(result.missingInformation)).toBe(true)
    expect(Array.isArray(result.warnings)).toBe(true)
    expect(result.grounded).toBe(false)
    expect(result.isDemo).toBe(false)
  })

  it('coerces null sources to empty array', () => {
    const result = normalizeAgentResult({ intent: INTENT.GENERAL, answer: 'hi', sources: null })
    expect(Array.isArray(result.sources)).toBe(true)
    expect(result.sources).toEqual([])
  })

  it('coerces non-boolean grounded to false', () => {
    const result = normalizeAgentResult({ intent: INTENT.GENERAL, answer: 'hi', grounded: 'yes' })
    expect(result.grounded).toBe(false)
  })

  it('preserves true grounded', () => {
    const result = normalizeAgentResult({ intent: INTENT.KNOWLEDGE, answer: 'hi', grounded: true })
    expect(result.grounded).toBe(true)
  })
})

describe('validateAgentResult', () => {
  it('validates a complete result', () => {
    const result = createAgentResult({ intent: INTENT.GENERAL, answer: 'test' })
    const validation = validateAgentResult(result)
    expect(validation.valid).toBe(true)
  })

  it('rejects null result', () => {
    const validation = validateAgentResult(null)
    expect(validation.valid).toBe(false)
  })

  it('rejects result without intent', () => {
    const validation = validateAgentResult({ status: 'success', answer: 'hi', agentsUsed: [], sources: [] })
    expect(validation.valid).toBe(false)
  })

  it('rejects result where answer is not a string', () => {
    const validation = validateAgentResult({ intent: INTENT.GENERAL, status: 'success', answer: 123, agentsUsed: [], sources: [] })
    expect(validation.valid).toBe(false)
  })
})
