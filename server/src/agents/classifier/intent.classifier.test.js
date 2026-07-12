/**
 * Intent Classifier tests — Phase 9.
 *
 * Tests both deterministic and Granite-based classification layers.
 * All IBM watsonx.ai calls are mocked via Jest.
 *
 * Run: cd server && npm test -- --testPathPattern=agents/classifier
 */
import { jest } from '@jest/globals'

// Must mock before importing classifier
jest.unstable_mockModule('../../providers/ai.provider.factory.js', () => ({
  getAiProvider: jest.fn(),
}))

const { getAiProvider } = await import('../../providers/ai.provider.factory.js')
const { classifyIntent } = await import('./intent.classifier.js')
const { INTENT, CONFIDENCE } = await import('../intents.js')

// Helper to create a mock AI provider returning given JSON
function mockProvider(jsonOutput) {
  return {
    generate: jest.fn().mockResolvedValue({
      content: JSON.stringify(jsonOutput),
      model: 'mock-granite',
      provider: 'mock',
      isDemo: true,
    }),
  }
}

describe('Intent Classifier — deterministic layer', () => {
  it('classifies weather keywords to WEATHER without calling Granite', async () => {
    const provider = { generate: jest.fn() }
    getAiProvider.mockReturnValue(provider)

    const result = await classifyIntent({ message: 'Will it rain tomorrow in Karnal?' })
    expect(result.primaryIntent).toBe(INTENT.WEATHER)
    expect(result.requiresLiveData).toBe(true)
    expect(provider.generate).not.toHaveBeenCalled()
  })

  it('classifies mandi price keywords to MARKET without calling Granite', async () => {
    const provider = { generate: jest.fn() }
    getAiProvider.mockReturnValue(provider)

    const result = await classifyIntent({ message: "What is today's tomato price in Karnal mandi?" })
    expect(result.primaryIntent).toBe(INTENT.MARKET)
    expect(result.requiresLiveData).toBe(true)
    expect(provider.generate).not.toHaveBeenCalled()
  })

  it('classifies weather + market to MULTI_INTENT without calling Granite', async () => {
    const provider = { generate: jest.fn() }
    getAiProvider.mockReturnValue(provider)

    const result = await classifyIntent({
      message: 'Will it rain tomorrow and what is the wheat mandi price?',
    })
    expect(result.primaryIntent).toBe(INTENT.MULTI_INTENT)
    expect(result.secondaryIntents).toContain(INTENT.WEATHER)
    expect(result.secondaryIntents).toContain(INTENT.MARKET)
    expect(provider.generate).not.toHaveBeenCalled()
  })

  it('passes non-deterministic queries to Granite', async () => {
    getAiProvider.mockReturnValue(
      mockProvider({
        primaryIntent: 'GENERAL',
        secondaryIntents: [],
        confidenceCategory: 'high',
        missingInformation: [],
        requiresLiveData: false,
        requiresKnowledgeRetrieval: false,
      })
    )
    const result = await classifyIntent({ message: 'What is crop rotation?' })
    expect(result.primaryIntent).toBe(INTENT.GENERAL)
  })
})

describe('Intent Classifier — Granite layer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('correctly classifies KNOWLEDGE intent from Granite', async () => {
    getAiProvider.mockReturnValue(
      mockProvider({
        primaryIntent: 'KNOWLEDGE',
        secondaryIntents: [],
        confidenceCategory: 'high',
        missingInformation: [],
        requiresLiveData: false,
        requiresKnowledgeRetrieval: true,
      })
    )
    const result = await classifyIntent({
      message: 'According to the uploaded documents, how should I improve soil health?',
    })
    expect(result.primaryIntent).toBe(INTENT.KNOWLEDGE)
    expect(result.requiresKnowledgeRetrieval).toBe(true)
  })

  it('correctly classifies CROP_RECOMMENDATION intent from Granite', async () => {
    // Use a message that does NOT match any deterministic rule so the LLM path is exercised.
    // "Which Kharif crop should I grow?" now matches the deterministic CROP_RECOMMENDATION
    // pattern (/\bwhich\s+(kharif|rabi|zaid)\b/i) and short-circuits before the LLM.
    // We use a message that is unambiguously crop-related but phrased differently.
    getAiProvider.mockReturnValue(
      mockProvider({
        primaryIntent: 'CROP_RECOMMENDATION',
        secondaryIntents: [],
        confidenceCategory: 'high',
        missingInformation: ['location', 'season', 'soilType'],
        requiresLiveData: false,
        requiresKnowledgeRetrieval: false,
      })
    )
    const result = await classifyIntent({ message: 'I need advice on selecting a profitable crop for next season.' })
    expect(result.primaryIntent).toBe(INTENT.CROP_RECOMMENDATION)
  })

  it('correctly classifies DISEASE intent from Granite', async () => {
    getAiProvider.mockReturnValue(
      mockProvider({
        primaryIntent: 'DISEASE',
        secondaryIntents: [],
        confidenceCategory: 'high',
        missingInformation: [],
        requiresLiveData: false,
        requiresKnowledgeRetrieval: false,
      })
    )
    const result = await classifyIntent({
      message: 'My tomato leaves have brown spots and yellow edges.',
    })
    expect(result.primaryIntent).toBe(INTENT.DISEASE)
  })

  it('correctly classifies SCHEME intent from Granite', async () => {
    getAiProvider.mockReturnValue(
      mockProvider({
        primaryIntent: 'SCHEME',
        secondaryIntents: [],
        confidenceCategory: 'high',
        missingInformation: [],
        requiresLiveData: false,
        requiresKnowledgeRetrieval: true,
      })
    )
    const result = await classifyIntent({
      message: 'Which irrigation government schemes apply to my farm?',
    })
    expect(result.primaryIntent).toBe(INTENT.SCHEME)
  })

  it('correctly classifies CLARIFICATION for vague messages', async () => {
    getAiProvider.mockReturnValue(
      mockProvider({
        primaryIntent: 'CLARIFICATION',
        secondaryIntents: [],
        confidenceCategory: 'low',
        missingInformation: [],
        requiresLiveData: false,
        requiresKnowledgeRetrieval: false,
      })
    )
    const result = await classifyIntent({ message: 'Help me with farming.' })
    expect(result.primaryIntent).toBe(INTENT.CLARIFICATION)
  })

  it('handles malformed Granite output and retries once', async () => {
    // First call returns JSON that parses but fails schema validation (no primaryIntent)
    const provider = {
      generate: jest.fn()
        .mockResolvedValueOnce({ content: '{"unknownField": "bad output", "confidence": 0.5}', model: 'mock', provider: 'mock', isDemo: true })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            primaryIntent: 'GENERAL',
            secondaryIntents: [],
            confidenceCategory: 'low',
            missingInformation: [],
            requiresLiveData: false,
            requiresKnowledgeRetrieval: false,
          }),
          model: 'mock',
          provider: 'mock',
          isDemo: true,
        }),
    }
    getAiProvider.mockReturnValue(provider)

    const result = await classifyIntent({ message: 'Please explain what mulching is and its benefits.' })
    expect(result.primaryIntent).toBe(INTENT.GENERAL)
    expect(provider.generate).toHaveBeenCalledTimes(2)
  })

  it('falls back safely when Granite classifier completely fails', async () => {
    const err = new Error('AI down')
    err.code = 'AI_PROVIDER_ERROR'
    const provider = { generate: jest.fn().mockRejectedValue(err) }
    getAiProvider.mockReturnValue(provider)

    const result = await classifyIntent({ message: 'What is drip irrigation?' })
    expect(result).toBeDefined()
    const validIntents = Object.values(INTENT)
    expect(validIntents).toContain(result.primaryIntent)
  })

  it('safety: deterministic layer catches weather before Granite', async () => {
    const provider = { generate: jest.fn() }
    getAiProvider.mockReturnValue(provider)

    const result = await classifyIntent({ message: 'Will it rain tomorrow in Nashik?' })
    expect(result.primaryIntent).toBe(INTENT.WEATHER)
    expect(provider.generate).not.toHaveBeenCalled()
  })

  it('safety: deterministic layer catches market before Granite', async () => {
    const provider = { generate: jest.fn() }
    getAiProvider.mockReturnValue(provider)

    const result = await classifyIntent({ message: "What is today's tomato price in Nashik mandi?" })
    expect(result.primaryIntent).toBe(INTENT.MARKET)
    expect(provider.generate).not.toHaveBeenCalled()
  })
})

describe('Intent Classifier — schema normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('normalizes output with missing optional fields', async () => {
    getAiProvider.mockReturnValue(
      mockProvider({
        primaryIntent: 'GENERAL',
        confidenceCategory: 'high',
        requiresLiveData: false,
        requiresKnowledgeRetrieval: false,
      })
    )
    const result = await classifyIntent({ message: 'Explain crop rotation.' })
    expect(Array.isArray(result.secondaryIntents)).toBe(true)
    expect(Array.isArray(result.missingInformation)).toBe(true)
  })

  it('uses fallback for unknown primaryIntent in Granite output', async () => {
    getAiProvider.mockReturnValue(
      mockProvider({
        primaryIntent: 'TOTALLY_UNKNOWN_INTENT',
        secondaryIntents: [],
        confidenceCategory: 'high',
        missingInformation: [],
        requiresLiveData: false,
        requiresKnowledgeRetrieval: false,
      })
    )
    const result = await classifyIntent({ message: 'Explain crop rotation.' })
    const validIntents = Object.values(INTENT)
    expect(validIntents).toContain(result.primaryIntent)
  })
})
