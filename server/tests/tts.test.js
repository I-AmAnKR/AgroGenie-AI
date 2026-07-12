/**
 * TTS Provider + Synthesize Endpoint Tests — Phase 14C.
 *
 * Tests:
 *   1. Mock TTS provider — shape, isDemo, error on empty text
 *   2. TTS provider factory — mock mode selection, health status
 *   3. POST /api/v1/voice/synthesize — valid text, errors, security
 *   4. GET /api/v1/voice/tts-ready — availability check
 *   5. extractSpeakableText — markdown stripping
 */
import { jest } from '@jest/globals'

// ── Mock the TTS factory for integration tests ────────────────────────────────
jest.unstable_mockModule('../src/providers/tts.provider.factory.js', () => {
  return {
    getTtsProvider: () => ({
      synthesize: async ({ text }) => {
        if (!text?.trim()) {
          const e = new Error('TTS requires non-empty text.')
          e.code = 'TTS_INVALID_INPUT'
          e.statusCode = 400
          throw e
        }
        await new Promise((r) => setTimeout(r, 10))
        // Return a tiny buffer (OGG silence)
        return {
          audioBuffer: Buffer.from('OggS' + '\x00'.repeat(50)),
          mimeType: 'audio/ogg',
          voice: 'mock-voice',
          provider: 'mock',
          isDemo: true,
        }
      },
      getHealthStatus: () => 'mock',
    }),
    getTtsHealthStatus: () => 'mock',
  }
})

jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

// Dynamic imports after mocks
const { default: app } = await import('../src/app.js')
const { default: request } = await import('supertest')
const { mockTtsProvider } = await import('../src/providers/mock/mock-tts.provider.js')
const { getTtsProvider, getTtsHealthStatus } = await import('../src/providers/tts.provider.factory.js')
const { extractSpeakableText } = await import('../src/controllers/voice.synthesize.controller.js')

// ── Mock TTS Provider Unit Tests ──────────────────────────────────────────────

describe('MockTTSProvider', () => {
  test('synthesize() returns required shape', async () => {
    const result = await mockTtsProvider.synthesize({
      text: 'Hello farmer, here is your crop advice.',
      language: 'en',
    })
    expect(result).toMatchObject({
      audioBuffer: expect.any(Buffer),
      mimeType: expect.stringMatching(/^audio\//),
      voice: expect.any(String),
      isDemo: true,
      provider: 'mock',
    })
  })

  test('audioBuffer is a non-empty Buffer', async () => {
    const result = await mockTtsProvider.synthesize({
      text: 'Test speech output.',
      language: 'en',
    })
    expect(result.audioBuffer).toBeInstanceOf(Buffer)
    expect(result.audioBuffer.length).toBeGreaterThan(0)
  })

  test('isDemo is always true', async () => {
    const result = await mockTtsProvider.synthesize({ text: 'Hi', language: 'en' })
    expect(result.isDemo).toBe(true)
  })

  test('provider is "mock"', async () => {
    const result = await mockTtsProvider.synthesize({ text: 'Hello', language: 'en' })
    expect(result.provider).toBe('mock')
  })

  test('throws TTS_INVALID_INPUT for empty text', async () => {
    await expect(
      mockTtsProvider.synthesize({ text: '', language: 'en' })
    ).rejects.toMatchObject({ code: 'TTS_INVALID_INPUT' })
  })

  test('throws TTS_INVALID_INPUT for whitespace-only text', async () => {
    await expect(
      mockTtsProvider.synthesize({ text: '   ', language: 'en' })
    ).rejects.toMatchObject({ code: 'TTS_INVALID_INPUT' })
  })

  test('getHealthStatus() returns "mock"', () => {
    expect(mockTtsProvider.getHealthStatus()).toBe('mock')
  })

  test('works with Hindi text', async () => {
    const result = await mockTtsProvider.synthesize({
      text: 'नमस्ते किसान भाई, आपकी फसल के बारे में जानकारी।',
      language: 'hi',
    })
    expect(result.audioBuffer.length).toBeGreaterThan(0)
    expect(result.isDemo).toBe(true)
  })
})

// ── TTS Provider Factory ──────────────────────────────────────────────────────

describe('getTtsProvider — mock mode', () => {
  test('returns a provider with synthesize method', () => {
    const provider = getTtsProvider()
    expect(typeof provider.synthesize).toBe('function')
  })

  test('returned provider synthesizes with isDemo=true', async () => {
    const provider = getTtsProvider()
    const result = await provider.synthesize({ text: 'Hello', language: 'en' })
    expect(result.isDemo).toBe(true)
  })

  test('provider has getHealthStatus method', () => {
    const provider = getTtsProvider()
    expect(typeof provider.getHealthStatus).toBe('function')
  })
})

describe('getTtsHealthStatus', () => {
  test('returns "mock" in mock mode', () => {
    expect(getTtsHealthStatus()).toBe('mock')
  })

  test('returns a valid status value', () => {
    const status = getTtsHealthStatus()
    expect(['mock', 'connected', 'not-configured']).toContain(status)
  })
})

// ── extractSpeakableText ──────────────────────────────────────────────────────

describe('extractSpeakableText', () => {
  test('strips markdown bold', () => {
    const result = extractSpeakableText('**Wheat** is a good crop.')
    expect(result).toBe('Wheat is a good crop.')
  })

  test('strips markdown headers', () => {
    const result = extractSpeakableText('## Crop Advice\nSow wheat in October.')
    expect(result).not.toContain('##')
    expect(result).toContain('Crop Advice')
  })

  test('strips source citations [1]', () => {
    const result = extractSpeakableText('Wheat yields are high [1] in Punjab [2].')
    expect(result).not.toMatch(/\[\d+\]/)
  })

  test('strips URLs', () => {
    const result = extractSpeakableText('Visit https://agmarknet.gov.in for prices.')
    expect(result).not.toContain('https://')
  })

  test('strips horizontal rules', () => {
    const result = extractSpeakableText('Top crops:\n---\nWheat')
    expect(result).not.toContain('---')
  })

  test('preserves sentence content', () => {
    const text = 'Sow maize in June for Kharif season in Rajasthan.'
    const result = extractSpeakableText(text)
    expect(result).toBe(text)
  })

  test('collapses multiple spaces', () => {
    const result = extractSpeakableText('Wheat   is   good.')
    expect(result).toBe('Wheat is good.')
  })

  test('handles empty string', () => {
    expect(extractSpeakableText('')).toBe('')
  })

  test('handles markdown italic', () => {
    const result = extractSpeakableText('*Kharif* season starts in June.')
    expect(result).not.toContain('*')
    expect(result).toContain('Kharif')
  })
})

// ── POST /api/v1/voice/synthesize ─────────────────────────────────────────────

describe('POST /api/v1/voice/synthesize', () => {
  describe('Valid text synthesis', () => {
    test('returns 200 with audio/ogg for valid text', async () => {
      const res = await request(app)
        .post('/api/v1/voice/synthesize')
        .send({ text: 'Sow wheat in October for Rabi season.', language: 'en' })

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toMatch(/audio\/ogg/)
    })

    test('response body is non-empty binary data', async () => {
      const res = await request(app)
        .post('/api/v1/voice/synthesize')
        .send({ text: 'Hello farmer.', language: 'en' })

      expect(res.body).toBeTruthy()
      // Response is binary, not JSON success wrapper
      expect(res.headers['content-type']).toMatch(/audio/)
    })

    test('X-TTS-Provider header is set', async () => {
      const res = await request(app)
        .post('/api/v1/voice/synthesize')
        .send({ text: 'Namaste.', language: 'en' })

      expect(res.headers['x-tts-provider']).toBeDefined()
    })

    test('X-TTS-Demo header is "true" in mock mode', async () => {
      const res = await request(app)
        .post('/api/v1/voice/synthesize')
        .send({ text: 'Crop advice here.', language: 'en' })

      expect(res.headers['x-tts-demo']).toBe('true')
    })

    test('Cache-Control is no-store', async () => {
      const res = await request(app)
        .post('/api/v1/voice/synthesize')
        .send({ text: 'Test', language: 'en' })

      expect(res.headers['cache-control']).toBe('no-store')
    })

    test('accepts Hindi text', async () => {
      const res = await request(app)
        .post('/api/v1/voice/synthesize')
        .send({ text: 'नमस्ते किसान।', language: 'hi' })

      expect(res.status).toBe(200)
    })

    test('response does not contain IBM credentials', async () => {
      const res = await request(app)
        .post('/api/v1/voice/synthesize')
        .send({ text: 'Test crop advice.', language: 'en' })

      // Headers should not leak credentials
      const headers = JSON.stringify(res.headers)
      expect(headers).not.toMatch(/IBM_TTS_API_KEY/i)
      expect(headers).not.toMatch(/access_token/i)
      expect(headers).not.toMatch(/Bearer /i)
    })
  })

  describe('Error handling', () => {
    test('returns 400 for missing text', async () => {
      const res = await request(app)
        .post('/api/v1/voice/synthesize')
        .send({ language: 'en' })

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    test('returns 400 for empty text', async () => {
      const res = await request(app)
        .post('/api/v1/voice/synthesize')
        .send({ text: '', language: 'en' })

      expect(res.status).toBe(400)
    })

    test('returns 400 for whitespace-only text', async () => {
      const res = await request(app)
        .post('/api/v1/voice/synthesize')
        .send({ text: '   ', language: 'en' })

      expect(res.status).toBe(400)
    })

    test('returns 413 for text exceeding 3000 chars', async () => {
      const longText = 'A'.repeat(3001)
      const res = await request(app)
        .post('/api/v1/voice/synthesize')
        .send({ text: longText, language: 'en' })

      expect(res.status).toBe(413)
    })

    test('error response is JSON', async () => {
      const res = await request(app)
        .post('/api/v1/voice/synthesize')
        .send({ text: '' })

      expect(res.headers['content-type']).toMatch(/json/)
      expect(res.body.success).toBe(false)
    })
  })
})

// ── GET /api/v1/voice/tts-ready ───────────────────────────────────────────────

describe('GET /api/v1/voice/tts-ready', () => {
  test('returns 200', async () => {
    const res = await request(app).get('/api/v1/voice/tts-ready')
    expect(res.status).toBe(200)
  })

  test('returns success: true', async () => {
    const res = await request(app).get('/api/v1/voice/tts-ready')
    expect(res.body.success).toBe(true)
  })

  test('response has available field', async () => {
    const res = await request(app).get('/api/v1/voice/tts-ready')
    expect(typeof res.body.data.available).toBe('boolean')
  })

  test('response has provider field', async () => {
    const res = await request(app).get('/api/v1/voice/tts-ready')
    expect(res.body.data.provider).toBeDefined()
  })

  test('response has isDemo field', async () => {
    const res = await request(app).get('/api/v1/voice/tts-ready')
    expect(typeof res.body.data.isDemo).toBe('boolean')
  })

  test('available is true in mock mode', async () => {
    const res = await request(app).get('/api/v1/voice/tts-ready')
    expect(res.body.data.available).toBe(true)
  })

  test('isDemo is true in mock mode', async () => {
    const res = await request(app).get('/api/v1/voice/tts-ready')
    expect(res.body.data.isDemo).toBe(true)
  })
})
