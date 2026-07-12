import { createDiseaseProfile, DISEASE_SEVERITY, DISEASE_STATUS, DISEASE_CATEGORY } from '../src/models/diseaseProfile.schema.js'

describe('DiseaseProfile Schema (Phase 15A)', () => {
  it('should create a valid profile with minimal required fields', () => {
    const raw = {
      diseaseCode: 'TEST-01',
      name: 'Test Disease',
      crop: 'Wheat',
    }

    const profile = createDiseaseProfile(raw)
    
    expect(profile.diseaseCode).toBe('TEST-01')
    expect(profile.name).toBe('Test Disease')
    expect(profile.crop).toBe('Wheat')
    expect(profile.severity).toBe(DISEASE_SEVERITY.MEDIUM) // default
    expect(profile.diseaseCategory).toBe(DISEASE_CATEGORY.OTHER) // default
    expect(profile.status).toBe(DISEASE_STATUS.ACTIVE) // default
    
    // Arrays should default to empty
    expect(profile.aliases).toEqual([])
    expect(profile.symptoms).toEqual([])
    expect(profile.affectedPlantParts).toEqual([])
    expect(profile.affectedGrowthStage).toEqual([])
    expect(profile.riskFactors).toEqual([])
    expect(profile.prevention).toEqual([])
    expect(profile.knowledgeDocumentIds).toEqual([])
    expect(profile.officialSources).toEqual([])
    
    // Structured objects should have null defaults
    expect(profile.environmentalConditions.temperature).toBeNull()
    expect(profile.treatment.immediateActions).toEqual([])
    expect(profile.treatment.chemicalTreatment).toBeNull()
  })

  it('should preserve provided arrays and structured fields', () => {
    const raw = {
      diseaseCode: 'TEST-02',
      name: 'Test Disease 2',
      crop: 'Rice',
      severity: DISEASE_SEVERITY.HIGH,
      symptoms: ['yellow leaves'],
      environmentalConditions: {
        temperature: '25-30C'
      },
      treatment: {
        organicTreatment: 'Neem oil',
        immediateActions: ['Remove plant']
      },
      prevention: ['Crop rotation'],
      officialSources: [
        { title: 'Source 1', url: 'http://test.com', sourceType: 'academic' }
      ]
    }

    const profile = createDiseaseProfile(raw)
    
    expect(profile.severity).toBe(DISEASE_SEVERITY.HIGH)
    expect(profile.symptoms).toEqual(['yellow leaves'])
    expect(profile.environmentalConditions.temperature).toBe('25-30C')
    expect(profile.treatment.organicTreatment).toBe('Neem oil')
    expect(profile.treatment.immediateActions).toEqual(['Remove plant'])
    expect(profile.prevention).toEqual(['Crop rotation'])
    expect(profile.officialSources[0].sourceType).toBe('academic')
  })
})
