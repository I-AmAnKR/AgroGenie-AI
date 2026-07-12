import { jest } from '@jest/globals'
import { INTENT, RESULT_STATUS } from '../src/agents/intents.js'
import { CONFIDENCE_LEVELS } from '../src/services/diseaseScoring.service.js'

// Mock the services and providers used by disease agent
jest.unstable_mockModule('../src/providers/vision.provider.factory.js', () => ({
  getVisionProvider: () => ({
    analyzeImage: jest.fn().mockResolvedValue(['brown spots', 'leaf curling'])
  })
}))

jest.unstable_mockModule('../src/providers/weather.provider.factory.js', () => ({
  getWeatherProvider: () => ({
    getCurrentWeather: jest.fn().mockResolvedValue({ current: { tempC: 25, humidity: 80 } })
  })
}))

jest.unstable_mockModule('../src/providers/ai.provider.factory.js', () => ({
  getAiProvider: () => ({
    generate: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        diseaseCandidates: [{ name: 'Test Disease', confidence: 'High', supportingEvidence: ['matches spots'] }],
        confidenceLevel: 'High',
        treatment: {},
        prevention: [],
        warnings: [],
        explanation: 'Test Explanation'
      })
    })
  })
}))

jest.unstable_mockModule('../src/services/disease.service.js', () => ({
  getDiseaseKnowledge: jest.fn().mockResolvedValue({
    profile: { name: 'Test Disease', crop: 'Test Crop' },
    ragContext: [{ source: 'Test Book' }]
  })
}))
jest.unstable_mockModule('../src/repositories/disease.repository.js', () => {
  const dummyDisease = {
    diseaseCode: 'TEST_DISEASE',
    name: 'Test Disease',
    crop: 'Test Crop',
    symptoms: ['brown spots', 'leaf curling'],
    environmentalConditions: { temperature: { min: 20, max: 30 }, humidity: { min: 60, max: 90 } }
  }
  return {
    findBySymptom: jest.fn().mockReturnValue([dummyDisease]),
    findByCode: jest.fn().mockReturnValue(dummyDisease)
  }
})
describe('Disease Agent', () => {
  let runDiseaseAgent

  beforeAll(async () => {
    const module = await import('../src/agents/disease/disease.agent.js')
    runDiseaseAgent = module.runDiseaseAgent
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should return Needs Clarification if no image attachment is provided', async () => {
    const result = await runDiseaseAgent({
      message: 'What is wrong with my plant?',
      attachments: []
    })
    expect(result.status).toBe(RESULT_STATUS.NEEDS_CLARIFICATION)
  })

  it('should run full pipeline when image is provided', async () => {
    const result = await runDiseaseAgent({
      message: 'Look at this leaf',
      attachments: [{ type: 'image', objectKey: 'test-image.jpg', mimeType: 'image/jpeg' }],
      farmerContext: { crop: { name: 'Test Crop' } }
    })

    expect(result.intent).toBe(INTENT.DISEASE)
    expect(result.status).toBe(RESULT_STATUS.SUCCESS)
    expect(result.answer).toBe('Test Explanation')
    expect(result.data.confidenceLevel).toBe('Medium')
    expect(result.grounded).toBe(true)
  })
})
