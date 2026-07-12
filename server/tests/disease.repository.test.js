import {
  findByCode,
  findByCrop,
  findBySymptom,
  findByAlias,
  searchByNameOrAlias,
  seedDiseases
} from '../src/repositories/disease.repository.js'
import { DISEASE_SEVERITY } from '../src/models/diseaseProfile.schema.js'

describe('Disease Repository (Phase 15A)', () => {
  // We use the default seeded mock data for these tests.
  
  it('should find disease by code', () => {
    const d = findByCode('D-WHEAT-RUST-01')
    expect(d).not.toBeNull()
    expect(d.name).toBe('Wheat Leaf Rust')
  })

  it('should find diseases by crop', () => {
    const list = findByCrop('Tomato')
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].diseaseCode).toBe('D-TOMATO-BLIGHT-01')
  })

  it('should find disease by symptom keyword', () => {
    const list = findBySymptom('pustules')
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].diseaseCode).toBe('D-WHEAT-RUST-01')
  })

  it('should find disease by alias exact match (case insensitive)', () => {
    const d = findByAlias('brown RUST')
    expect(d).not.toBeNull()
    expect(d.diseaseCode).toBe('D-WHEAT-RUST-01')
  })

  it('should search by name or alias', () => {
    const list = searchByNameOrAlias('blight')
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].name).toContain('Blight')
  })

  it('should ignore deprecated status profiles', () => {
    // Seed a deprecated profile temporarily
    seedDiseases([
      {
        diseaseCode: 'D-DEPRECATED-01',
        name: 'Deprecated Disease',
        crop: 'Wheat',
        status: 'DEPRECATED'
      }
    ])
    
    expect(findByCode('D-DEPRECATED-01')).toBeNull()
    expect(findByCrop('Wheat').length).toBe(0)
    
    // Reset seed back for any other tests if needed, but since it's the end of block it's fine
  })
})
