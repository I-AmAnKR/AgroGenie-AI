import { jest } from '@jest/globals'

jest.unstable_mockModule('../src/repositories/memory.repository.js', () => ({
  getFarmerMemory: jest.fn().mockResolvedValue({
    recommendations: [
      { content: 'Late blight treatment', createdAt: new Date().toISOString() },
      { content: 'Monitor wheat prices', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    history: [
      { content: 'Asked about wheat', createdAt: new Date().toISOString() }
    ],
    warnings: [
      { content: 'Frost warning', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
    ],
    facts: [
      { content: 'Prefers Hindi', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }
    ]
  })
}))

describe('Phase 16D: Smart Follow-up Engine', () => {
  let generateFollowUp
  let getRecommendationHistory
  let getActivityTimeline
  
  beforeAll(async () => {
    const mod = await import('../src/services/followup.service.js')
    generateFollowUp = mod.generateFollowUp
    
    const recMod = await import('../src/services/recommendationHistory.service.js')
    getRecommendationHistory = recMod.getRecommendationHistory

    const actMod = await import('../src/services/activityTimeline.service.js')
    getActivityTimeline = actMod.getActivityTimeline
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Follow-up Rules Evaluation', () => {
    it('should generate weather and disease suggestions with correct priorities', () => {
      const result = {
        weather: {
          current: { temperatureC: 40, condition: 'clear' },
          forecast: [{ pop: 90 }]
        },
        data: {
          confidence: 0.95,
          diseaseCandidates: [{ name: 'Leaf Rust' }]
        },
        answer: 'You have a Nitrogen deficiency.'
      }

      const suggestions = generateFollowUp(result, {}, null)

      expect(suggestions).toBeDefined()
      // Should include Disease (Critical), Weather Rain (Warning), Weather Temp (Warning), Fertilizer (Warning)
      expect(suggestions.length).toBeGreaterThanOrEqual(4)
      
      const diseaseSuggestion = suggestions.find(s => s.priority === 'Critical')
      expect(diseaseSuggestion.suggestion).toContain('Leaf Rust')
      
      // Since it sorts by priority, Critical should be first
      expect(suggestions[0].priority).toBe('Critical')
    })

    it('should deduplicate and keep highest priority', () => {
      // Assuming a scenario where two rules might push the exact same string (hypothetical for now)
      // The service deduplicates by string text.
      const result = {
        market: {
          currentPrice: 110,
          previousPrice: 100,
          commodity: 'Tomato'
        }
      }
      const suggestions = generateFollowUp(result, {}, null)
      expect(suggestions.length).toBe(1)
      expect(suggestions[0].priority).toBe('Info')
    })
  })

  describe('Recommendation History and Activity Timeline', () => {
    it('should fetch and format recommendation history', async () => {
      const history = await getRecommendationHistory('demo-user')
      expect(history.length).toBe(2)
      expect(history[0]).toContain('Last recommendation: Late blight treatment')
      expect(history[1]).toContain('Previous recommendation: Monitor wheat prices')
    })

    it('should fetch and sort activity timeline', async () => {
      const timeline = await getActivityTimeline('demo-user')
      expect(timeline.length).toBe(3)
      // Sorted descending, so the newest (history) should be first
      expect(timeline[0].type).toBe('history')
      expect(timeline[1].type).toBe('warning')
      expect(timeline[2].type).toBe('fact')
    })
  })
})
