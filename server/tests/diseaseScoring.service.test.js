import { determineDiseaseAdvisory, CONFIDENCE_LEVELS } from '../src/services/diseaseScoring.service.js'

describe('Disease Scoring Service', () => {
  const dummyDisease = {
    diseaseCode: 'WHEAT_RUST',
    name: 'Wheat Rust',
    crop: 'Wheat',
    symptoms: ['orange pustules', 'yellowing leaves'],
    environmentalConditions: {
      temperature: { min: 15, max: 25 },
      humidity: { min: 60, max: 100 }
    }
  }

  it('should score high when symptoms, weather, and crop match', () => {
    const candidateSymptoms = ['orange pustules', 'yellowing leaves']
    const weather = { current: { tempC: 20, humidity: 80 } }
    const crop = 'Wheat'

    const result = determineDiseaseAdvisory([dummyDisease], candidateSymptoms, weather, crop)
    
    expect(result.primaryDisease).toBeDefined()
    expect(result.primaryDisease.confidenceLevel).toBe(CONFIDENCE_LEVELS.HIGH)
    expect(result.primaryDisease.progressionRisk).toContain('HIGH')
  })

  it('should score lower when weather does not match', () => {
    const candidateSymptoms = ['orange pustules', 'yellowing leaves']
    const weather = { current: { tempC: 35, humidity: 30 } } // Too hot and dry
    const crop = 'Wheat'

    const result = determineDiseaseAdvisory([dummyDisease], candidateSymptoms, weather, crop)
    
    expect(result.primaryDisease).toBeDefined()
    expect(result.primaryDisease.confidence).toBeLessThan(85) // High starts at 85
    expect(result.primaryDisease.progressionRisk).toBe('NORMAL')
  })

  it('should return Needs Expert Review if confidence is too low', () => {
    const dummyDiseaseLow = { ...dummyDisease, symptoms: ['something else entirely'] }
    const candidateSymptoms = ['completely unrelated symptom']
    
    // Using default config minConfidence of 65
    const result = determineDiseaseAdvisory([dummyDiseaseLow], candidateSymptoms, null, null)
    
    expect(result.primaryDisease).toBeDefined()
    expect(result.primaryDisease.confidenceLevel).toBe(CONFIDENCE_LEVELS.NEEDS_EXPERT_REVIEW)
  })
})
