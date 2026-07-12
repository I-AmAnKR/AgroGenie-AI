/**
 * AI Provider & Chat Service Tests — Phase 6
 *
 * Tests:
 *   - Mock provider generate() returns normalized shape with isDemo: true
 *   - Mock provider safety refusals (weather, price, scheme, crop)
 *   - Chat endpoint Phase 6 response contract (provider, model, isDemo, sources)
 *   - Conversation continuity (conversationId reuse)
 *   - Unknown conversationId creates new conversation without error
 *   - Unsupported language normalized (no error)
 *   - Supported Hindi language accepted
 *   - Health endpoint AI status field
 *   - AI test endpoint behavior
 *   - Full response shape compliance
 *
 * Note: The watsonx SDK is NOT mocked here because Jest ESM module mocking
 * with `jest.unstable_mockModule` requires the mocks to be set up before
 * any dynamic imports in the test body, which is complex with our ESM setup.
 * The watsonx provider is tested indirectly via config.providers.useMocks=true
 * which routes all requests through MockAIProvider in the test environment.
 * The real provider is validated manually (see PROGRESS.md manual test procedure).
 *
 * Run: cd server && npm test -- --testPathPattern=ai.provider
 */
import request from 'supertest'
import app from '../src/app.js'
import { mockAiProvider } from '../src/providers/mock/mock-ai.provider.js'
import { getAiHealthStatus } from '../src/providers/ai.provider.factory.js'
import { buildSystemPrompt } from '../src/prompts/agrogenie.system.prompt.js'

// ── Mock Provider Unit Tests ──────────────────────────────────────────────────

describe('MockAIProvider.generate() — normalized interface', () => {
  it('returns all required normalized fields', async () => {
    const result = await mockAiProvider.generate({
      messages: [{ role: 'user', content: 'What is crop rotation?' }],
      systemPrompt: 'You are AgroGenie.',
      parameters: {},
      metadata: { requestId: 'test-req-01' },
    })

    expect(result).toHaveProperty('content')
    expect(result).toHaveProperty('model')
    expect(result).toHaveProperty('provider')
    expect(result).toHaveProperty('usage')
    expect(result).toHaveProperty('finishReason')
    expect(result).toHaveProperty('isDemo')
  })

  it('isDemo is true for mock provider', async () => {
    const result = await mockAiProvider.generate({
      messages: [{ role: 'user', content: 'Hello' }],
      systemPrompt: '',
      parameters: {},
      metadata: {},
    })
    expect(result.isDemo).toBe(true)
  })

  it('provider is "mock"', async () => {
    const result = await mockAiProvider.generate({
      messages: [{ role: 'user', content: 'Hello' }],
      systemPrompt: '',
      parameters: {},
      metadata: {},
    })
    expect(result.provider).toBe('mock')
  })

  it('usage object has inputTokens and outputTokens fields', async () => {
    const result = await mockAiProvider.generate({
      messages: [{ role: 'user', content: 'Hello' }],
      systemPrompt: '',
      parameters: {},
      metadata: {},
    })
    expect(result.usage).toHaveProperty('inputTokens')
    expect(result.usage).toHaveProperty('outputTokens')
  })

  it('content is a non-empty string', async () => {
    const result = await mockAiProvider.generate({
      messages: [{ role: 'user', content: 'Tell me about wheat.' }],
      systemPrompt: '',
      parameters: {},
      metadata: {},
    })
    expect(typeof result.content).toBe('string')
    expect(result.content.length).toBeGreaterThan(0)
  })

  it('uses last user message from history to determine response', async () => {
    const result = await mockAiProvider.generate({
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
        { role: 'user', content: 'Will it rain tomorrow?' },
      ],
      systemPrompt: '',
      parameters: {},
      metadata: {},
    })
    // Should pick weather-related canned response
    expect(result.content.toLowerCase()).toMatch(/live|not available|demo|imd|phase 10/)
  })
})

// ── MockAIProvider Safety Refusals ────────────────────────────────────────────

describe('MockAIProvider safety behaviors', () => {
  it('weather query mentions lack of live data', async () => {
    const result = await mockAiProvider.generate({
      messages: [{ role: 'user', content: 'Will it rain tomorrow in my village?' }],
      systemPrompt: '',
      parameters: {},
      metadata: {},
    })
    expect(result.content.toLowerCase()).toMatch(/live|not available|demo|imd/)
  })

  it('mandi price query does not invent live prices', async () => {
    const result = await mockAiProvider.generate({
      messages: [{ role: 'user', content: 'What is today\'s tomato price in Karnal?' }],
      systemPrompt: '',
      parameters: {},
      metadata: {},
    })
    expect(result.content.toLowerCase()).toMatch(/live|not available|demo|agmarknet/)
  })

  it('scheme query does not guarantee eligibility', async () => {
    const result = await mockAiProvider.generate({
      messages: [{ role: 'user', content: 'Tell me a government subsidy I definitely qualify for.' }],
      systemPrompt: '',
      parameters: {},
      metadata: {},
    })
    expect(result.content.toLowerCase()).toMatch(/eligibility|kvk|verify|contact|cannot confirm/)
  })

  it('crop query asks for missing context', async () => {
    const result = await mockAiProvider.generate({
      messages: [{ role: 'user', content: 'Which crop should I grow?' }],
      systemPrompt: '',
      parameters: {},
      metadata: {},
    })
    expect(result.content.toLowerCase()).toMatch(/district|soil|season|irrigation|location|details/)
  })
})

// ── System Prompt Tests ────────────────────────────────────────────────────────

describe('System Prompt Builder', () => {
  it('buildSystemPrompt returns a non-empty string', () => {
    const prompt = buildSystemPrompt('en')
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(50)
  })

  it('English prompt includes English language instruction', () => {
    const prompt = buildSystemPrompt('en')
    expect(prompt).toContain('Respond in clear English')
  })

  it('Hindi prompt includes Hindi language instruction', () => {
    const prompt = buildSystemPrompt('hi')
    expect(prompt).toContain('Hindi')
    expect(prompt).toContain('Devanagari')
  })

  it('Punjabi prompt includes Punjabi language instruction', () => {
    const prompt = buildSystemPrompt('pa')
    expect(prompt).toContain('Punjabi')
    expect(prompt).toContain('Gurmukhi')
  })

  it('unknown language falls back to English instruction', () => {
    const prompt = buildSystemPrompt('fr')
    expect(prompt).toContain('Respond in clear English')
  })

  it('prompt instructs model not to invent weather data', () => {
    const prompt = buildSystemPrompt('en')
    expect(prompt.toLowerCase()).toContain('never invent weather')
  })

  it('prompt instructs model not to invent mandi prices', () => {
    const prompt = buildSystemPrompt('en')
    expect(prompt.toLowerCase()).toContain('never invent mandi prices')
  })
})

// ── AI Provider Factory (mock mode only) ─────────────────────────────────────

describe('AI Provider Factory — mock mode', () => {
  it('getAiHealthStatus returns "mock" in test environment', () => {
    // TEST env has USE_MOCK_PROVIDERS=true (default), so factory returns mock
    const status = getAiHealthStatus()
    expect(status).toBe('mock')
  })
})

// ── Chat Endpoint — Phase 6 Response Contract ─────────────────────────────────

describe('POST /api/v1/chat — Phase 6 response contract', () => {
  it('returns 200 with assistant message', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'What is crop rotation?' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.message.role).toBe('assistant')
    expect(res.body.data.message.content).toBeTruthy()
  })

  it('response includes conversationId', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Hello' })
    expect(res.status).toBe(200)
    expect(res.body.data.conversationId).toBeDefined()
    expect(typeof res.body.data.conversationId).toBe('string')
    expect(res.body.data.conversationId.length).toBeGreaterThan(0)
  })

  it('response includes provider field', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Tell me about wheat cultivation.' })
    expect(res.status).toBe(200)
    expect(['mock', 'watsonx']).toContain(res.body.data.provider)
  })

  it('response includes model field', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Hello' })
    expect(res.status).toBe(200)
    expect(res.body.data.model).toBeDefined()
  })

  it('response includes isDemo boolean field', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Hello' })
    expect(res.status).toBe(200)
    expect(typeof res.body.data.isDemo).toBe('boolean')
  })

  it('sources is an empty array in Step 6 (no RAG)', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'What crops grow in Haryana?' })
    expect(res.status).toBe(200)
    expect(res.body.data.sources).toBeInstanceOf(Array)
    expect(res.body.data.sources).toHaveLength(0)
  })

  it('agentActivity is a non-empty array', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'What is drip irrigation?' })
    expect(res.status).toBe(200)
    expect(res.body.data.agentActivity).toBeInstanceOf(Array)
    expect(res.body.data.agentActivity.length).toBeGreaterThan(0)
  })

  it('in mock mode isDemo is true', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Hello' })
    expect(res.status).toBe(200)
    expect(res.body.data.isDemo).toBe(true)
  })

  it('message object has role, content, and timestamp', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Hello' })
    expect(res.status).toBe(200)
    const msg = res.body.data.message
    expect(msg.role).toBe('assistant')
    expect(msg.content).toBeTruthy()
    expect(msg.timestamp).toBeDefined()
  })
})

// ── Conversation Continuity ───────────────────────────────────────────────────

describe('Conversation continuity', () => {
  it('sends same conversationId in followup and gets same ID back', async () => {
    const first = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'What is crop rotation?' })
    expect(first.status).toBe(200)
    const convId = first.body.data.conversationId
    expect(convId).toBeDefined()

    const second = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Tell me more about it.', conversationId: convId })
    expect(second.status).toBe(200)
    expect(second.body.data.conversationId).toBe(convId)
  })

  it('unknown conversationId creates new conversation without error', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Hello', conversationId: 'totally-unknown-id-xyz-123' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // New ID issued — not the supplied unknown ID
    expect(res.body.data.conversationId).not.toBe('totally-unknown-id-xyz-123')
  })
})

// ── Language Handling ─────────────────────────────────────────────────────────

describe('Language handling', () => {
  it('unsupported language is normalized (no error)', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Hello', language: 'fr' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('Hindi language code accepted', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'फसल चक्रण क्या है?', language: 'hi' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('Punjabi language code accepted', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Hello', language: 'pa' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})

// ── Input Validation ──────────────────────────────────────────────────────────

describe('Chat input validation', () => {
  it('returns 400 when message is missing', async () => {
    const res = await request(app).post('/api/v1/chat').send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when message is empty string', async () => {
    const res = await request(app).post('/api/v1/chat').send({ message: '' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ── Health Endpoint AI Status ─────────────────────────────────────────────────

describe('GET /api/v1/health — AI status', () => {
  it('ai field is defined', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.data.ai).toBeDefined()
    expect(typeof res.body.data.ai).toBe('string')
  })

  it('ai field is "mock" in test environment', async () => {
    const res = await request(app).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.data.ai).toBe('mock')
  })

  it('ai field is a valid status value', async () => {
    const res = await request(app).get('/api/v1/health')
    const validStatuses = ['mock', 'connected', 'not-configured', 'error']
    expect(validStatuses).toContain(res.body.data.ai)
  })
})

// ── AI Test Endpoint ──────────────────────────────────────────────────────────

describe('POST /api/v1/ai/test — dev endpoint', () => {
  it('returns 400 when message is missing (validation always active)', async () => {
    const res = await request(app)
      .post('/api/v1/ai/test')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('response is 200 or 404 (200 in dev mode, 404 in test mode)', async () => {
    const res = await request(app)
      .post('/api/v1/ai/test')
      .send({ message: 'Explain crop rotation in simple language.' })
    expect([200, 404]).toContain(res.status)
    if (res.status === 200) {
      expect(res.body.data.content).toBeDefined()
      expect(res.body.data.provider).toBeDefined()
      expect(typeof res.body.data.isDemo).toBe('boolean')
    }
  })
})

// ── Safety Behavior via Chat Endpoint ─────────────────────────────────────────

describe('Safety behaviors via POST /api/v1/chat', () => {
  it('weather query is handled by Weather Agent (Phase 10)', async () => {
    // Phase 10: Weather Agent is live. A message without a recognized location
    // returns either a clarification request or a location-not-found error.
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Will it rain tomorrow in my village?' })
    expect(res.status).toBe(200)
    const intent = res.body.data.routing?.intent
    expect(intent).toBe('WEATHER')
    // Answer must not fabricate weather data
    const content = res.body.data.message.content.toLowerCase()
    expect(content).not.toMatch(/temperature is \d{3}|rainfall of \d{3} mm/i)
  })

  it('price query response does not invent live mandi prices', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'What is today\'s tomato price in Karnal?' })
    expect(res.status).toBe(200)
    const content = res.body.data.message.content.toLowerCase()
    expect(content).toMatch(/live|not available|demo|agmarknet|phase 11/)
  })

  it('scheme query does not guarantee eligibility', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Tell me a government subsidy I definitely qualify for.' })
    expect(res.status).toBe(200)
    const content = res.body.data.message.content.toLowerCase()
    expect(content).toMatch(/eligibility|kvk|verify|contact|cannot confirm/)
  })

  it('crop query asks for location/soil/season context', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'Which crop should I grow?' })
    expect(res.status).toBe(200)
    const content = res.body.data.message.content.toLowerCase()
    expect(content).toMatch(/district|soil|season|irrigation|location|details/)
  })
})

// ── Full Response Shape Compliance ────────────────────────────────────────────

describe('Chat response shape compliance — complete contract', () => {
  it('all required fields present in response data', async () => {
    const res = await request(app)
      .post('/api/v1/chat')
      .send({ message: 'What is crop rotation?', userId: 'test-user-phase6' })
    expect(res.status).toBe(200)

    const { data } = res.body
    // Top-level fields
    expect(data).toHaveProperty('conversationId')
    expect(data).toHaveProperty('message')
    expect(data).toHaveProperty('provider')
    expect(data).toHaveProperty('model')
    expect(data).toHaveProperty('agentActivity')
    expect(data).toHaveProperty('sources')
    expect(data).toHaveProperty('isDemo')

    // Message sub-fields
    expect(data.message).toHaveProperty('role', 'assistant')
    expect(data.message).toHaveProperty('content')
    expect(data.message).toHaveProperty('timestamp')

    // sources must be empty array in Step 6 (no RAG)
    expect(data.sources).toEqual([])
  })
})
