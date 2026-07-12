import { jest } from '@jest/globals'
import { INTENT } from '../src/agents/intents.js'

// Mock the AI Provider factory
const mockAiProvider = {
  generate: jest.fn().mockResolvedValue({
    content: 'This is a mock human-readable explanation from Granite.'
  })
}

jest.unstable_mockModule('../src/providers/ai.provider.factory.js', () => ({
  getAiProvider: jest.fn(() => mockAiProvider)
}))

// Mock logger
jest.unstable_mockModule('../src/utils/logger.js', () => ({
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}))

describe('Explainability Service', () => {
  let generateExplainability

  beforeAll(async () => {
    const mod = await import('../src/services/explainability.service.js')
    generateExplainability = mod.generateExplainability
  })

  afterEach(() => {
    jest.clearAllMocks()
    mockAiProvider.generate.mockResolvedValue({
      content: 'This is a mock human-readable explanation from Granite.'
    })
  })

  it('should generate structured explainability data correctly for a market query', async () => {
    const result = {
      agentsUsed: ['MarketAgent'],
      market: {
        commodity: 'Wheat',
        market: 'Karnal'
      },
      sources: [],
      grounded: false
    }

    const routing = {
      intent: INTENT.MARKET,
      confidenceCategory: 'high'
    }

    const memoryContext = '- Preferences: Wheat, Hindi'

    const explainability = await generateExplainability(result, routing, memoryContext, { requestId: 'test-req' })

    expect(explainability).toBeDefined()
    expect(explainability.sourceAgent).toBe('MarketAgent')
    expect(explainability.supportingEvidence).toContain('Market Data: Wheat in Karnal')
    expect(explainability.memoryUsed).toContain('- Preferences: Wheat, Hindi')
    expect(explainability.confidenceReason).toBe('Intent was clearly matched and data was available.')
    expect(explainability.agentContributions['Market Service']).toBeDefined()
    expect(explainability.decisionTimeline.length).toBeGreaterThan(0)
    expect(explainability.decisionTimeline.find(t => t.step === 'Market')).toBeDefined()
    expect(explainability.decisionTimeline.find(t => t.step === 'Memory')).toBeDefined()
    expect(explainability.explanation).toBe('This is a mock human-readable explanation from Granite.')

    // Verify Granite was called
    expect(mockAiProvider.generate).toHaveBeenCalledTimes(1)
  })

  it('should generate structured explainability data correctly for a disease query', async () => {
    const result = {
      agentsUsed: ['DiseaseAgent'],
      data: {
        confidenceLevel: 'High',
        confidence: 0.95,
        diseaseCandidates: [{ name: 'Leaf Rust' }]
      },
      sources: ['Disease Doc 1'],
      grounded: true
    }

    const routing = {
      intent: INTENT.DISEASE,
      confidenceCategory: 'high'
    }

    const memoryContext = null

    const explainability = await generateExplainability(result, routing, memoryContext, { requestId: 'test-req' })

    expect(explainability).toBeDefined()
    expect(explainability.sourceAgent).toBe('DiseaseAgent')
    expect(explainability.supportingEvidence).toContain('Disease Confidence: High (95.0%)')
    expect(explainability.memoryUsed).toEqual([])
    expect(explainability.confidenceReason).toBe('Disease diagnostic confidence is High.')
    expect(explainability.agentContributions['Vision Provider']).toBeDefined()
    expect(explainability.agentContributions['Disease Repository']).toBeDefined()
    expect(explainability.agentContributions['Deterministic Scoring Engine']).toBeDefined()
    expect(explainability.ragSources).toContain('Disease Doc 1')
    
    // Timeline checks
    expect(explainability.decisionTimeline.find(t => t.step === 'Repository')).toBeDefined()
    expect(explainability.decisionTimeline.find(t => t.step === 'RAG')).toBeDefined()
  })

  it('should handle Granite generation failures gracefully', async () => {
    mockAiProvider.generate.mockRejectedValue(new Error('LLM Failed'))

    const result = {
      agentsUsed: ['WeatherAgent']
    }
    const routing = {
      intent: INTENT.WEATHER,
      confidenceCategory: 'high'
    }

    const explainability = await generateExplainability(result, routing, null, { requestId: 'test-req' })

    expect(explainability).toBeDefined()
    expect(explainability.explanation).toBe('The decision was made based on the provided inputs and deterministic rules.')
  })
})
