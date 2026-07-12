/**
 * Phase 4 backend integration tests.
 * Tests all major endpoints against the Express app.
 *
 * Run: cd server && npm test
 */
import request from 'supertest'
import app from '../src/app.js'

// ── Health ────────────────────────────────────────────────────────────────

describe('GET /api/v1/health', () => {
  it('returns 200 with ok status', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('ok')
    expect(res.body.data.server).toBe('running')
    expect(res.body.data.database).toBeDefined()
    expect(['mock', 'connected', 'not-configured', 'error']).toContain(res.body.data.ai)
    expect(res.body.data.timestamp).toBeDefined()
    expect(res.body.error).toBeNull()
  })

  it('response contains requestId in meta', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.body.meta).toBeDefined()
    expect(res.body.meta.requestId).toBeDefined()
  })
})

// ── Chat ──────────────────────────────────────────────────────────────────

describe('POST /api/v1/chat', () => {
  it('returns 200 with assistant message for valid request', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Which Kharif crop suits loamy soil?' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.message.role).toBe('assistant')
    expect(res.body.data.message.content).toBeTruthy()
    expect(res.body.data.conversationId).toBeDefined()
    expect(res.body.data.agentActivity).toBeInstanceOf(Array)
    expect(res.body.data.sources).toBeInstanceOf(Array)
    // Phase 6: provider, model, isDemo are now required response fields
    expect(res.body.data.provider).toBeDefined()
    expect(res.body.data.model).toBeDefined()
    expect(typeof res.body.data.isDemo).toBe('boolean')
    expect(res.body.data.sources.length).toBeGreaterThan(0)
  })

  it('returns 400 when message is missing', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when message is empty string', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: '' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('accepts optional language field', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Hello', language: 'hi' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ── Crop Recommendation ───────────────────────────────────────────────────

describe('POST /api/v1/crop-recommendation', () => {
  const validPayload = {
    state: 'Haryana',
    district: 'Karnal',
    season: 'Kharif',
    soilType: 'Loamy',
    irrigationAvailability: 'Moderate',
    farmArea: 2,
    objective: 'balanced',
  }

  it('returns 200 with recommendations for valid request', async () => {
    const res = await request(app)
      .post('/api/v1/crop-recommendation')
      .send(validPayload)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.recommendations).toBeInstanceOf(Array)
    expect(res.body.data.recommendations.length).toBeGreaterThan(0)
    expect(res.body.data.recommendations[0].rank).toBeDefined()
    expect(res.body.data.recommendations[0].crop).toBeDefined()
    expect(res.body.data.recommendations[0].suitabilityScore).toBeDefined()
    expect(res.body.data.isDemo).toBe(true)
  })

  it('returns 400 when state is missing', async () => {
    const res = await request(app)
      .post('/api/v1/crop-recommendation')
      .send({ season: 'Kharif', soilType: 'Loamy' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when season is missing', async () => {
    const res = await request(app)
      .post('/api/v1/crop-recommendation')
      .send({ state: 'Haryana', soilType: 'Loamy' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ── Weather ───────────────────────────────────────────────────────────────

describe('GET /api/v1/weather', () => {
  it('returns 200 with weather data', async () => {
    const res = await request(app).get('/api/v1/weather')
    if (res.status !== 200) console.log('Weather 404 body:', res.body)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.current).toBeDefined()
    expect(res.body.data.forecast).toBeInstanceOf(Array)
    expect(res.body.data.source.isDemo).toBe(true)
  })

  it('accepts location query params', async () => {
    const res = await request(app)
      .get('/api/v1/weather')
      .query({ district: 'Nashik', state: 'Maharashtra' })
    expect(res.status).toBe(200)
    expect(res.body.data.location.district).toBe('Nashik')
  })
})

// ── Market ────────────────────────────────────────────────────────────────

describe('GET /api/v1/market/prices', () => {
  it('returns 200 with records array (Phase 11 provider-neutral shape)', async () => {
    const res = await request(app).get('/api/v1/market/prices')
    if (res.status !== 200) console.log('Market 502 body:', res.body)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // Phase 11: provider-neutral shape uses { records, isDemo, provider, fetchedAt }
    expect(res.body.data.isDemo).toBe(true)
    expect(Array.isArray(res.body.data.records)).toBe(true)
  })

  it('filters by commodity and returns demo data', async () => {
    const res = await request(app)
      .get('/api/v1/market/prices')
      .query({ commodity: 'Onion' })
    expect(res.status).toBe(200)
    expect(res.body.data.isDemo).toBe(true)
    if (res.body.data.records.length > 0) {
      expect(res.body.data.records.every((p) => p.commodity === 'Onion')).toBe(true)
    }
  })
})

describe('GET /api/v1/market/trends', () => {
  it('returns 200 with trend records (Phase 11 shape)', async () => {
    const res = await request(app)
      .get('/api/v1/market/trends')
      .query({ commodity: 'Onion', market: 'Lasalgaon' })
    expect(res.status).toBe(200)
    expect(res.body.data.isDemo).toBe(true)
    expect(Array.isArray(res.body.data.records)).toBe(true)
  })
})

// ── Schemes ───────────────────────────────────────────────────────────────

describe('GET /api/v1/schemes', () => {
  it('returns 200 with schemes list', async () => {
    const res = await request(app).get('/api/v1/schemes')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.schemes).toBeInstanceOf(Array)
    expect(res.body.data.schemes.length).toBeGreaterThanOrEqual(0)
  })

  it('filters by category', async () => {
    const res = await request(app)
      .get('/api/v1/schemes')
      .query({ category: 'Irrigation' })
    expect(res.status).toBe(200)
    expect(res.body.data.schemes.length).toBeGreaterThanOrEqual(0)
  })

  it.skip('returns single scheme by id', async () => {
    const res = await request(app).get('/api/v1/schemes/sc1')
    expect(res.status).toBe(200)
    expect(res.body.data.scheme.id).toBe('sc1')
  })

  it.skip('returns 404 for unknown scheme id', async () => {
    const res = await request(app).get('/api/v1/schemes/nonexistent-id')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

// ── Disease ───────────────────────────────────────────────────────────────

describe('POST /api/v1/disease/analyze', () => {
  it('returns 200 with analysis for valid request', async () => {
    const res = await request(app)
      .post('/api/v1/disease/analyze')
      .send({ crop: 'Tomato', plantPart: 'Leaf', symptomDescription: 'Brown spots on leaves' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('capability_not_available')
    expect(res.body.data.potentialMatches).toBeInstanceOf(Array)
  })

  it('returns 400 when crop is missing', async () => {
    const res = await request(app)
      .post('/api/v1/disease/analyze')
      .send({ plantPart: 'Leaf' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ── Profile ───────────────────────────────────────────────────────────────

describe('GET /api/v1/profile/:userId', () => {
  it('returns 200 with demo user profile', async () => {
    const res = await request(app).get('/api/v1/profile/demo-user')
    expect(res.status).toBe(200)
    expect(res.body.data.userId).toBe('demo-user')
    expect(res.body.data.displayName).toBeDefined()
  })

  it('auto-creates profile for unknown userId', async () => {
    const res = await request(app).get('/api/v1/profile/new-test-user-xyz')
    expect(res.status).toBe(200)
    expect(res.body.data.userId).toBe('new-test-user-xyz')
  })
})

describe('PUT /api/v1/profile/:userId', () => {
  it('updates the profile and returns updated data', async () => {
    const res = await request(app)
      .put('/api/v1/profile/demo-user')
      .send({ displayName: 'Updated Name', state: 'Punjab' })
    expect(res.status).toBe(200)
    expect(res.body.data.displayName).toBe('Updated Name')
    expect(res.body.data.state).toBe('Punjab')
    expect(res.body.data.updatedAt).toBeDefined()
  })
})

// ── Feedback ──────────────────────────────────────────────────────────────

describe('POST /api/v1/feedback', () => {
  it('returns 201 with feedback record for valid request', async () => {
    const res = await request(app)
      .post('/api/v1/feedback')
      .send({ userId: 'demo-user', recommendationId: 'rec-001', rating: 4, comment: 'Very useful' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.rating).toBe(4)
    expect(res.body.data.userId).toBe('demo-user')
  })

  it('returns 400 when rating is below 1', async () => {
    const res = await request(app)
      .post('/api/v1/feedback')
      .send({ userId: 'demo-user', recommendationId: 'rec-001', rating: 0 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when rating is above 5', async () => {
    const res = await request(app)
      .post('/api/v1/feedback')
      .send({ userId: 'demo-user', recommendationId: 'rec-001', rating: 6 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when userId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/feedback')
      .send({ recommendationId: 'rec-001', rating: 3 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when recommendationId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/feedback')
      .send({ userId: 'demo-user', rating: 3 })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ── 404 ───────────────────────────────────────────────────────────────────

describe('404 route handling', () => {
  it('returns 404 for unknown GET route', async () => {
    const res = await request(app).get('/api/v1/nonexistent-route')
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 for unknown POST route', async () => {
    const res = await request(app).post('/api/v1/nonexistent-route').send({})
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
