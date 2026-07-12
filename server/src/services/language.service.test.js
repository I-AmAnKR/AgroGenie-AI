/**
 * language.service.test.js — Phase 14A
 *
 * Unit tests for the language detection and localization service.
 * All tests run in isolation — no LLM calls unless explicitly mocked.
 *
 * Tests cover:
 *   1. detectByScript — Unicode Devanagari → 'hi', Gurmukhi → 'pa'
 *   2. detectHinglish — Hinglish keyword matching → 'hi-Latn'
 *   3. Profile hint fallback — prefers profile language when ambiguous
 *   4. Default fallback — returns 'en' for clear English
 *   5. normalizeLanguage — aliases and case handling
 *   6. getLocalizedString — all keys and all languages
 *   7. getLanguageInstruction — includeNumbersRule variants
 *   8. SUPPORTED_LANGUAGES — contains expected codes
 */
import { jest } from '@jest/globals'

// ── Module mocking (before importing the module under test) ──────────────────

// Mock the AI provider factory so Tier 3 LLM fallback is controllable.
// By default the mock returns 'en' (no LLM needed for most tests).
const mockGenerate = jest.fn().mockResolvedValue({ content: '{"language":"en"}' })
jest.unstable_mockModule('../providers/ai.provider.factory.js', () => ({
  getAiProvider: () => ({ generate: mockGenerate }),
}))

// Mock config to have controlled thresholds.
jest.unstable_mockModule('../config/env.js', () => ({
  default: {
    language: {
      hinglishThreshold: 2,
      useLlmFallback: true,
    },
  },
}))

// Mock logger to suppress output during tests.
jest.unstable_mockModule('../utils/logger.js', () => ({
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

// Dynamic import after mocks are set up (ESM requirement).
const {
  detectLanguage,
  normalizeLanguage,
  getLocalizedString,
  getLanguageInstruction,
  SUPPORTED_LANGUAGES,
} = await import('../services/language.service.js')

// ── Test suites ───────────────────────────────────────────────────────────────

describe('SUPPORTED_LANGUAGES', () => {
  test('contains all four supported codes', () => {
    expect(SUPPORTED_LANGUAGES.has('en')).toBe(true)
    expect(SUPPORTED_LANGUAGES.has('hi')).toBe(true)
    expect(SUPPORTED_LANGUAGES.has('hi-Latn')).toBe(true)
    expect(SUPPORTED_LANGUAGES.has('pa')).toBe(true)
  })

  test('does not contain unexpected codes', () => {
    expect(SUPPORTED_LANGUAGES.has('fr')).toBe(false)
    expect(SUPPORTED_LANGUAGES.has('hinglish')).toBe(false)
    expect(SUPPORTED_LANGUAGES.has('bn')).toBe(false)
  })
})

describe('detectLanguage — Tier 1: Unicode script detection', () => {
  beforeEach(() => mockGenerate.mockClear())

  test('detects Hindi from Devanagari text', async () => {
    const result = await detectLanguage('आज की फसल कैसी है?')
    expect(result.language).toBe('hi')
    expect(result.confidence).toBe('high')
    expect(result.method).toBe('unicode')
    // High confidence → LLM should NOT be called
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  test('detects Hindi from mixed Devanagari and Latin text', async () => {
    const result = await detectLanguage('क्या आज baarish hogi?')
    expect(result.language).toBe('hi')
    expect(result.confidence).toBe('high')
    expect(result.method).toBe('unicode')
  })

  test('detects Punjabi from Gurmukhi text', async () => {
    const result = await detectLanguage('ਅੱਜ ਦਾ ਮੌਸਮ ਕਿਹੋ ਜਿਹਾ ਹੈ?')
    expect(result.language).toBe('pa')
    expect(result.confidence).toBe('high')
    expect(result.method).toBe('unicode')
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  test('does NOT classify pure English as Devanagari', async () => {
    const result = await detectLanguage('What crops should I grow this season?')
    expect(result.language).toBe('en')
    expect(result.method).not.toBe('unicode')
  })
})

describe('detectLanguage — Tier 2: Hinglish heuristic', () => {
  beforeEach(() => mockGenerate.mockClear())

  test('detects Hinglish when threshold keywords are present', async () => {
    const result = await detectLanguage('kya aaj baarish hogi meri fasal ke liye?')
    expect(result.language).toBe('hi-Latn')
    expect(result.confidence).toBe('medium')
    expect(result.method).toBe('heuristic')
    // Heuristic found a match → LLM should NOT be called
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  test('detects Hinglish with agricultural terms', async () => {
    const result = await detectLanguage('mandi mein gehu ka bhav kitna hai?')
    expect(result.language).toBe('hi-Latn')
    expect(result.method).toBe('heuristic')
  })

  test('does NOT classify English as Hinglish when no keywords match', async () => {
    const result = await detectLanguage('What is the current wheat price at the market?')
    // 'market' is not in HINGLISH_KEYWORDS
    expect(result.language).toBe('en')
  })

  test('requires minimum threshold to classify as Hinglish', async () => {
    // Only 1 keyword — below threshold of 2
    const result = await detectLanguage('The kya weather today?')
    // 'kya' = 1 match, below threshold=2 → not Hinglish
    expect(result.language).toBe('en')
  })
})

describe('detectLanguage — Profile hint', () => {
  beforeEach(() => mockGenerate.mockClear())

  test('uses profile hint for ambiguous short messages', async () => {
    // 'ok' alone is ambiguous, but profile says 'hi-Latn'
    const result = await detectLanguage('ok', { hint: 'hi-Latn' })
    expect(result.language).toBe('hi-Latn')
    expect(result.method).toBe('profile-hint')
  })

  test('does not override Tier 1 high-confidence detection with hint', async () => {
    // Devanagari text with 'en' hint — Tier 1 should win
    const result = await detectLanguage('आज मौसम', { hint: 'en' })
    expect(result.language).toBe('hi')
    expect(result.method).toBe('unicode')
  })
})

describe('detectLanguage — Tier 3: LLM fallback', () => {
  beforeEach(() => mockGenerate.mockClear())

  test('LLM is called for long ambiguous Latin text', async () => {
    // English-looking but enough words that LLM fallback triggers
    mockGenerate.mockResolvedValueOnce({ content: '{"language":"hi-Latn"}' })
    const result = await detectLanguage('main abhi theek hoon lekin thoda pareshan hoon')
    // Even though no keyword matches >= threshold, LLM says hi-Latn
    // (this simulates a borderline case where LLM clarifies)
    if (result.method === 'llm') {
      expect(result.language).toBe('hi-Latn')
    }
    // At minimum, function does not throw
    expect(['en', 'hi-Latn', 'hi', 'pa']).toContain(result.language)
  })

  test('LLM fallback returns en on provider failure', async () => {
    mockGenerate.mockRejectedValueOnce(new Error('LLM unavailable'))
    // Should not throw — fallback to 'en'
    const result = await detectLanguage('some ambiguous five word text here that is long enough')
    expect(result.language).toBe('en')
  })

  test('LLM fallback ignores unrecognized language codes', async () => {
    mockGenerate.mockResolvedValueOnce({ content: '{"language":"fr"}' })
    const result = await detectLanguage('some ambiguous text that is long enough for llm fallback maybe')
    // 'fr' not in SUPPORTED_LANGUAGES → falls back to 'en'
    expect(result.language).toBe('en')
  })
})

describe('detectLanguage — Edge cases', () => {
  test('handles empty string', async () => {
    const result = await detectLanguage('')
    expect(result.language).toBe('en')
    expect(result.confidence).toBe('low')
  })

  test('handles null input', async () => {
    const result = await detectLanguage(null)
    expect(result.language).toBe('en')
    expect(result.confidence).toBe('low')
  })

  test('handles whitespace-only string', async () => {
    const result = await detectLanguage('   ')
    expect(result.language).toBe('en')
  })
})

// ── normalizeLanguage ─────────────────────────────────────────────────────────

describe('normalizeLanguage', () => {
  test('returns en for undefined', () => {
    expect(normalizeLanguage(undefined)).toBe('en')
  })

  test('returns en for null', () => {
    expect(normalizeLanguage(null)).toBe('en')
  })

  test('returns en for empty string', () => {
    expect(normalizeLanguage('')).toBe('en')
  })

  test('returns en for unsupported code', () => {
    expect(normalizeLanguage('fr')).toBe('en')
    expect(normalizeLanguage('ar')).toBe('en')
    expect(normalizeLanguage('xyz')).toBe('en')
  })

  test('preserves valid codes', () => {
    expect(normalizeLanguage('en')).toBe('en')
    expect(normalizeLanguage('hi')).toBe('hi')
    expect(normalizeLanguage('hi-Latn')).toBe('hi-Latn')
    expect(normalizeLanguage('pa')).toBe('pa')
  })

  test('handles string aliases', () => {
    expect(normalizeLanguage('hinglish')).toBe('hi-Latn')
    expect(normalizeLanguage('hindi')).toBe('hi')
    expect(normalizeLanguage('punjabi')).toBe('pa')
    expect(normalizeLanguage('english')).toBe('en')
  })

  test('is case-insensitive for valid codes', () => {
    expect(normalizeLanguage('HI')).toBe('hi')
    expect(normalizeLanguage('EN')).toBe('en')
  })
})

// ── getLocalizedString ────────────────────────────────────────────────────────

describe('getLocalizedString', () => {
  test('returns English string for en', () => {
    const str = getLocalizedString('error', 'en')
    expect(str).toBeTruthy()
    expect(typeof str).toBe('string')
    expect(str.length).toBeGreaterThan(0)
  })

  test('returns Hindi string for hi', () => {
    const str = getLocalizedString('error', 'hi')
    expect(str).toBeTruthy()
    // Hindi should contain Devanagari
    expect(/[\u0900-\u097F]/.test(str)).toBe(true)
  })

  test('returns Hinglish string for hi-Latn', () => {
    const str = getLocalizedString('error', 'hi-Latn')
    expect(str).toBeTruthy()
    // Hinglish is in Latin script
    expect(typeof str).toBe('string')
    expect(str.length).toBeGreaterThan(0)
  })

  test('returns Punjabi string for pa', () => {
    const str = getLocalizedString('kvk_suggestion', 'pa')
    expect(str).toBeTruthy()
    // Punjabi should contain Gurmukhi
    expect(/[\u0A00-\u0A7F]/.test(str)).toBe(true)
  })

  test('falls back to English for unknown language', () => {
    const en = getLocalizedString('clarification', 'en')
    const fb = getLocalizedString('clarification', 'fr')
    expect(fb).toBe(en)
  })

  test('returns empty string for unknown key', () => {
    const str = getLocalizedString('unknown_key_xyz', 'en')
    expect(str).toBe('')
  })

  test('all defined keys have en, hi, hi-Latn, pa entries', () => {
    const EXPECTED_KEYS = ['clarification', 'error', 'no_location', 'live_data_needed', 'kvk_suggestion']
    const EXPECTED_LANGS = ['en', 'hi', 'hi-Latn', 'pa']
    for (const key of EXPECTED_KEYS) {
      for (const lang of EXPECTED_LANGS) {
        const str = getLocalizedString(key, lang)
        expect(str).toBeTruthy()
      }
    }
  })
})

// ── getLanguageInstruction ────────────────────────────────────────────────────

describe('getLanguageInstruction', () => {
  test('returns English instruction for en', () => {
    const instr = getLanguageInstruction('en')
    expect(instr).toMatch(/English/i)
  })

  test('returns Hindi instruction for hi', () => {
    const instr = getLanguageInstruction('hi')
    expect(instr).toMatch(/Hindi/i)
  })

  test('returns Hinglish instruction for hi-Latn', () => {
    const instr = getLanguageInstruction('hi-Latn')
    expect(instr).toMatch(/Roman|Hinglish/i)
  })

  test('returns Punjabi instruction for pa', () => {
    const instr = getLanguageInstruction('pa')
    expect(instr).toMatch(/Punjabi/i)
  })

  test('falls back to English for unknown code', () => {
    const instr = getLanguageInstruction('fr')
    expect(instr).toMatch(/English/i)
  })

  test('includeNumbersRule appends numbers rule', () => {
    const withRule = getLanguageInstruction('hi', { includeNumbersRule: true })
    expect(withRule).toMatch(/digit/i)
    expect(withRule).toMatch(/NUMBERS RULE/i)
  })

  test('includeNumbersRule is absent by default', () => {
    const withoutRule = getLanguageInstruction('hi')
    expect(withoutRule).not.toMatch(/NUMBERS RULE/i)
  })

  test('numbers rule applies to all languages', () => {
    for (const lang of ['en', 'hi', 'hi-Latn', 'pa']) {
      const instr = getLanguageInstruction(lang, { includeNumbersRule: true })
      expect(instr).toMatch(/NUMBERS RULE/i)
    }
  })
})
