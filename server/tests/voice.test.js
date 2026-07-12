/**
 * Voice Endpoint Integration Tests — Phase 14B.
 *
 * Tests POST /api/v1/voice/transcribe.
 *
 * Strategy: Mock the STT provider factory so it always returns the mock provider.
 * This makes tests deterministic and independent of USE_MOCK_PROVIDERS env var.
 *
 * Covers:
 *   - Valid audio upload → 200 + transcript
 *   - Missing audio field → 400
 *   - Invalid MIME type (image) → 415
 *   - Oversized audio → 413
 *   - Response shape compliance
 *   - isDemo flag in mock mode
 *   - language hint passed through
 *   - Security: no credentials or audio bytes in response
 */
import { jest } from '@jest/globals'

// ── Mock the STT factory so tests always use the mock provider ───────────────
// This makes the test independent of USE_MOCK_PROVIDERS env var.
jest.unstable_mockModule('../src/providers/stt.provider.factory.js', () => {
  return {
    getSttProvider: () => ({
      transcribe: async ({ language = 'en' }) => {
        const TRANSCRIPTS = {
          hi: 'मुझे अपनी फसल के लिए सबसे अच्छी सलाह दीजिए।',
          'hi-Latn': 'Meri fasal ke liye kya uchit hai is mausam mein?',
          pa: 'ਮੇਰੀ ਫ਼ਸਲ ਲਈ ਕਿਹੜੀ ਖਾਦ ਵਧੀਆ ਹੈ?',
          en: 'What is the best crop for the Kharif season in Rajasthan?',
        }
        // small delay to simulate async
        await new Promise((r) => setTimeout(r, 10))
        return {
          transcript: TRANSCRIPTS[language] ?? TRANSCRIPTS.en,
          language,
          confidence: 0.97,
          isDemo: true,
          provider: 'mock',
          model: 'mock-stt',
        }
      },
      getHealthStatus: () => 'mock',
    }),
    getSttHealthStatus: () => 'mock',
  }
})

// Silence logger output in tests
jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

// Dynamic import AFTER mocks are set up
const { default: app } = await import('../src/app.js')
const { default: request } = await import('supertest')

// ── Helpers ───────────────────────────────────────────────────────────────────

// Minimal valid WebM header bytes
const WEBM_MAGIC = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...Array(100).fill(0)])
// Minimal WAV header
const WAV_MAGIC = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(100)])
// Minimal OGG header
const OGG_MAGIC = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(100)])

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/voice/transcribe', () => {
  describe('Valid audio upload', () => {
    test('returns 200 with transcript for audio/webm', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', WEBM_MAGIC, { filename: 'recording.webm', contentType: 'audio/webm' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })

    test('response has required fields', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', WEBM_MAGIC, { filename: 'recording.webm', contentType: 'audio/webm' })

      const data = res.body.data
      expect(data).toHaveProperty('transcript')
      expect(data).toHaveProperty('detectedLanguage')
      expect(data).toHaveProperty('confidence')
      expect(data).toHaveProperty('provider')
      expect(data).toHaveProperty('isDemo')
    })

    test('transcript is a non-empty string', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', WEBM_MAGIC, { filename: 'recording.webm', contentType: 'audio/webm' })

      expect(typeof res.body.data.transcript).toBe('string')
      expect(res.body.data.transcript.length).toBeGreaterThan(0)
    })

    test('isDemo is true in mock mode', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', WEBM_MAGIC, { filename: 'recording.webm', contentType: 'audio/webm' })

      expect(res.body.data.isDemo).toBe(true)
    })

    test('provider is "mock" in mock mode', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', WEBM_MAGIC, { filename: 'recording.webm', contentType: 'audio/webm' })

      expect(res.body.data.provider).toBe('mock')
    })

    test('detectedLanguage is a valid language code', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', WEBM_MAGIC, { filename: 'recording.webm', contentType: 'audio/webm' })

      const VALID_LANGS = ['en', 'hi', 'hi-Latn', 'pa']
      expect(VALID_LANGS).toContain(res.body.data.detectedLanguage)
    })

    test('response does not expose IBM credentials or bearer tokens', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', WEBM_MAGIC, { filename: 'recording.webm', contentType: 'audio/webm' })

      const body = JSON.stringify(res.body)
      expect(body).not.toMatch(/apiKey/i)
      expect(body).not.toMatch(/access_token/i)
      expect(body).not.toMatch(/Bearer /i)
    })

    test('audio/wav is accepted', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', WAV_MAGIC, { filename: 'recording.wav', contentType: 'audio/wav' })

      expect(res.status).toBe(200)
    })

    test('audio/ogg is accepted', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', OGG_MAGIC, { filename: 'recording.ogg', contentType: 'audio/ogg' })

      expect(res.status).toBe(200)
    })

    test('language=hi hint returns Devanagari transcript', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .field('language', 'hi')
        .attach('audio', WEBM_MAGIC, { filename: 'recording.webm', contentType: 'audio/webm' })

      expect(res.status).toBe(200)
      // Hindi transcript should contain Devanagari characters
      if (res.body.data?.transcript) {
        expect(/[\u0900-\u097F]/.test(res.body.data.transcript)).toBe(true)
      }
    })

    test('confidence is a number between 0 and 1', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', WEBM_MAGIC, { filename: 'recording.webm', contentType: 'audio/webm' })

      const { confidence } = res.body.data
      expect(typeof confidence).toBe('number')
      expect(confidence).toBeGreaterThanOrEqual(0)
      expect(confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('Error handling', () => {
    test('returns 400 when no audio file is sent', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .send({})

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    test('returns VOICE_NO_AUDIO code when file is missing', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .send({ message: 'no file' })

      expect(res.body.success).toBe(false)
      // Code is in error object (standard apiResponse format)
      const errorCode = res.body.error?.code ?? res.body.code
      expect(errorCode).toBe('VOICE_NO_AUDIO')
    })

    test('returns 415 or 400 for image/jpeg MIME type', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', Buffer.alloc(100), {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        })

      // Multer fileFilter rejects non-audio at 415; controller gives 400 if it gets through
      expect([400, 415]).toContain(res.status)
      expect(res.body.success).toBe(false)
    })

    test('returns 415 or 400 for text/plain MIME type', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', Buffer.from('hello world'), {
          filename: 'note.txt',
          contentType: 'text/plain',
        })

      expect([400, 415]).toContain(res.status)
      expect(res.body.success).toBe(false)
    })

    test('returns 413 for file exceeding 5 MB limit', async () => {
      // 6 MB — exceeds default 5 MB limit
      const oversized = Buffer.alloc(6 * 1024 * 1024)

      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', oversized, { filename: 'big.webm', contentType: 'audio/webm' })

      expect(res.status).toBe(413)
    })
  })

  describe('Security', () => {
    test('route is accessible (returns 2xx or 4xx, not 401/403)', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', WEBM_MAGIC, { filename: 'recording.webm', contentType: 'audio/webm' })

      // Should NOT return 401 (Unauthorized) or 403 (Forbidden)
      expect(res.status).not.toBe(401)
      expect(res.status).not.toBe(403)
    })

    test('response body does not include raw audio bytes', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', WEBM_MAGIC, { filename: 'recording.webm', contentType: 'audio/webm' })

      const body = JSON.stringify(res.body)
      expect(body).not.toMatch(/audioBuffer/i)
      expect(body).not.toMatch(/"buffer"/i)
    })

    test('model field does not expose internal service URL', async () => {
      const res = await request(app)
        .post('/api/v1/voice/transcribe')
        .attach('audio', WEBM_MAGIC, { filename: 'recording.webm', contentType: 'audio/webm' })

      const body = JSON.stringify(res.body)
      expect(body).not.toMatch(/iam\.cloud\.ibm\.com/i)
      expect(body).not.toMatch(/IBM_STT_URL/i)
    })
  })
})
