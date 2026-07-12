/**
 * Phase 17A: Production Hardening Tests
 *
 * Tests:
 *  - /health liveness probe
 *  - /health/ready readiness probe
 *  - Security headers (Helmet)
 *  - Rate limit config (skip in test)
 *  - Request ID header echoing
 *  - Upload MIME type enforcement
 *  - 404 error shape
 */
import { jest } from '@jest/globals'
import request from 'supertest'

// ── Module mocks ─────────────────────────────────────────────────────────────
jest.unstable_mockModule('../src/services/db.service.js', () => ({
  getDb: jest.fn().mockReturnValue({ command: jest.fn() }),
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
}))

jest.unstable_mockModule('../src/repositories/knowledgeChunk.repository.js', () => ({
  countIndexedDocuments: jest.fn().mockResolvedValue(42),
  deleteChunksByDocumentId: jest.fn().mockResolvedValue(0),
  findAllChunksWithVectors: jest.fn().mockResolvedValue([]),
  upsertChunk: jest.fn().mockResolvedValue({}),
  upsertChunks: jest.fn().mockResolvedValue({ upsertedCount: 0 }),
  findChunksByDocumentId: jest.fn().mockResolvedValue([]),
  countChunks: jest.fn().mockResolvedValue(0),
  _clearMemStore: jest.fn(),
}))

jest.unstable_mockModule('../src/providers/ai.provider.factory.js', () => ({
  getAiProvider: jest.fn().mockReturnValue({ generate: jest.fn() }),
  getAiHealthStatus: jest.fn().mockReturnValue('mock'),
}))

jest.unstable_mockModule('../src/providers/storage.provider.factory.js', () => ({
  getStorageProvider: jest.fn(),
  getStorageHealthStatus: jest.fn().mockReturnValue('mock'),
}))

jest.unstable_mockModule('../src/providers/embedding.provider.factory.js', () => ({
  getEmbeddingProvider: jest.fn(),
  getEmbeddingHealthStatus: jest.fn().mockReturnValue('mock'),
}))

jest.unstable_mockModule('../src/providers/weather.provider.factory.js', () => ({
  getWeatherProvider: jest.fn(),
  getWeatherHealthStatus: jest.fn().mockReturnValue('mock'),
}))

jest.unstable_mockModule('../src/providers/market.provider.factory.js', () => ({
  getMarketProvider: jest.fn(),
  getMarketHealthStatus: jest.fn().mockReturnValue('mock'),
}))

jest.unstable_mockModule('../src/providers/stt.provider.factory.js', () => ({
  getSttProvider: jest.fn(),
  getSttHealthStatus: jest.fn().mockReturnValue('mock'),
}))

jest.unstable_mockModule('../src/providers/tts.provider.factory.js', () => ({
  getTtsProvider: jest.fn(),
  getTtsHealthStatus: jest.fn().mockReturnValue('mock'),
}))

jest.unstable_mockModule('../src/services/weatherCache.service.js', () => ({
  getCacheStats: jest.fn().mockReturnValue({ size: 0 }),
  buildCacheKey: jest.fn().mockReturnValue('mock-key'),
  getFromCache: jest.fn().mockReturnValue(null),
  setInCache: jest.fn(),
  invalidateCache: jest.fn(),
  clearCache: jest.fn(),
}))

jest.unstable_mockModule('../src/services/marketCache.service.js', () => ({
  getMarketCacheStats: jest.fn().mockReturnValue({ size: 0 }),
  buildMarketCacheKey: jest.fn().mockReturnValue('mock-key'),
  getMarketFromCache: jest.fn().mockReturnValue(null),
  setMarketInCache: jest.fn(),
  invalidateMarketCache: jest.fn(),
  clearMarketCache: jest.fn(),
}))

describe('Phase 17A: Production Hardening', () => {
  let app

  beforeAll(async () => {
    const mod = await import('../src/app.js')
    app = mod.default
  })

  // ── Liveness probe ─────────────────────────────────────────────────────────
  describe('GET /api/v1/health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/api/v1/health')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.status).toBe('ok')
      expect(res.body.data.server).toBe('running')
      expect(res.body.data.timestamp).toBeDefined()
    })

    it('should include all required fields', async () => {
      const res = await request(app).get('/api/v1/health')
      const d = res.body.data
      expect(d).toHaveProperty('database')
      expect(d).toHaveProperty('ai')
      expect(d).toHaveProperty('storage')
      expect(d).toHaveProperty('stt')
      expect(d).toHaveProperty('tts')
      expect(d).toHaveProperty('rag')
      expect(d).toHaveProperty('weather')
      expect(d).toHaveProperty('market')
      expect(d).toHaveProperty('uptime')
      expect(d).toHaveProperty('version')
      expect(d).toHaveProperty('mockMode')
      expect(d).toHaveProperty('demoMode')
    })
  })

  // ── Readiness probe ────────────────────────────────────────────────────────
  describe('GET /api/v1/health/ready', () => {
    it('should return 200 with status ready in mock mode', async () => {
      const res = await request(app).get('/api/v1/health/ready')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.status).toBe('ready')
      expect(res.body.data.checks).toBeDefined()
    })

    it('should include checks for database, ai, and storage', async () => {
      const res = await request(app).get('/api/v1/health/ready')
      const { checks } = res.body.data
      expect(checks).toHaveProperty('database')
      expect(checks).toHaveProperty('ibmGranite')
      expect(checks).toHaveProperty('ibmCOS')
      expect(checks).toHaveProperty('ibmSTT')
      expect(checks).toHaveProperty('ibmTTS')
      expect(checks).toHaveProperty('mongodb')
    })
  })

  // ── Security headers ───────────────────────────────────────────────────────
  describe('Security headers (Helmet)', () => {
    it('should set X-Content-Type-Options: nosniff', async () => {
      const res = await request(app).get('/api/v1/health')
      expect(res.headers['x-content-type-options']).toBe('nosniff')
    })

    it('should set X-Frame-Options header', async () => {
      const res = await request(app).get('/api/v1/health')
      expect(res.headers['x-frame-options']).toBeDefined()
    })

    it('should set content-security-policy header', async () => {
      const res = await request(app).get('/api/v1/health')
      expect(res.headers['content-security-policy']).toBeDefined()
    })
  })

  // ── Request ID ─────────────────────────────────────────────────────────────
  describe('Request ID middleware', () => {
    it('should echo a supplied X-Request-ID header', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('X-Request-ID', 'test-req-123')
      expect(res.headers['x-request-id']).toBe('test-req-123')
      expect(res.body.meta.requestId).toBe('test-req-123')
    })

    it('should generate a request ID when none is supplied', async () => {
      const res = await request(app).get('/api/v1/health')
      expect(res.headers['x-request-id']).toBeDefined()
      expect(res.headers['x-request-id'].length).toBeGreaterThan(0)
    })
  })

  // ── 404 handling ───────────────────────────────────────────────────────────
  describe('404 not found handler', () => {
    it('should return a structured 404 for unknown routes', async () => {
      const res = await request(app).get('/api/v1/does-not-exist')
      expect(res.status).toBe(404)
      expect(res.body.success).toBe(false)
      expect(res.body.error.code).toBe('NOT_FOUND')
    })
  })

  // ── Monitoring API (Step 17 Part 4) ────────────────────────────────────────
  describe('GET /api/v1/monitoring/status', () => {
    it('should return 200 with system status', async () => {
      const res = await request(app).get('/api/v1/monitoring/status')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.overallHealth).toBeDefined()
      expect(res.body.data.services).toBeDefined()
      expect(res.body.data.uptime).toBeGreaterThanOrEqual(0)
    })

    it('should include all IBM service statuses', async () => {
      const res = await request(app).get('/api/v1/monitoring/status')
      const { services } = res.body.data
      expect(services).toHaveProperty('mongodb')
      expect(services).toHaveProperty('ibmGranite')
      expect(services).toHaveProperty('ibmCOS')
      expect(services).toHaveProperty('ibmSTT')
      expect(services).toHaveProperty('ibmTTS')
      expect(services).toHaveProperty('weatherApi')
      expect(services).toHaveProperty('marketApi')
    })
  })

  describe('GET /api/v1/monitoring/stats', () => {
    it('should return 200 with usage statistics', async () => {
      const res = await request(app).get('/api/v1/monitoring/stats')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(typeof res.body.data.totalConversations).toBe('number')
      expect(typeof res.body.data.weatherRequests).toBe('number')
      expect(typeof res.body.data.cropRecommendations).toBe('number')
    })
  })

  describe('GET /api/v1/monitoring/demo', () => {
    it('should return 200 with demo mode info', async () => {
      const res = await request(app).get('/api/v1/monitoring/demo')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(typeof res.body.data.demoMode).toBe('boolean')
    })
  })
})
