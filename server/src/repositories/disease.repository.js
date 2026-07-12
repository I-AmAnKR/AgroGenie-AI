/**
 * Disease Repository — Phase 15A.
 *
 * Provides data access to verified agricultural disease profiles.
 * In Phase 15A, this uses in-memory mock data (similar to scheme.repository.js).
 * Later phases will connect this to MongoDB.
 */
import { createDiseaseProfile, DISEASE_SEVERITY, DISEASE_STATUS, DISEASE_CATEGORY } from '../models/diseaseProfile.schema.js'

// In-memory store for Phase 15A
let diseases = []

/**
 * Seed the in-memory repository with some initial verified disease profiles.
 */
export function seedDiseases(seedData) {
  diseases = seedData.map(createDiseaseProfile)
}

/**
 * Find a disease by its unique code.
 * @param {string} diseaseCode 
 * @returns {object|null} Disease profile or null
 */
export function findByCode(diseaseCode) {
  return diseases.find(d => d.diseaseCode === diseaseCode && d.status !== DISEASE_STATUS.DEPRECATED) || null
}

/**
 * Find diseases associated with a specific crop.
 * @param {string} cropCode 
 * @returns {object[]} Array of disease profiles
 */
export function findByCrop(cropCode) {
  return diseases.filter(d => 
    d.crop.toLowerCase() === cropCode.toLowerCase() && 
    d.status !== DISEASE_STATUS.DEPRECATED
  )
}

/**
 * Find diseases that list a specific symptom keyword.
 * @param {string} symptomKeyword 
 * @returns {object[]} Array of disease profiles
 */
export function findBySymptom(symptomKeyword) {
  const keyword = symptomKeyword.toLowerCase()
  return diseases.filter(d => 
    d.status !== DISEASE_STATUS.DEPRECATED &&
    d.symptoms.some(sym => sym.toLowerCase().includes(keyword))
  )
}

/**
 * Find a disease by an exact alias match.
 * @param {string} alias 
 * @returns {object|null} Disease profile or null
 */
export function findByAlias(alias) {
  const normalizedAlias = alias.toLowerCase()
  return diseases.find(d => 
    d.status !== DISEASE_STATUS.DEPRECATED &&
    d.aliases.some(a => a.toLowerCase() === normalizedAlias)
  ) || null
}

/**
 * Search for diseases matching a text query in name or aliases.
 * @param {string} query 
 * @returns {object[]} Array of disease profiles
 */
export function searchByNameOrAlias(query) {
  if (!query || query.trim() === '') return []
  
  const normalizedQuery = query.toLowerCase()
  return diseases.filter(d => {
    if (d.status === DISEASE_STATUS.DEPRECATED) return false
    
    if (d.name.toLowerCase().includes(normalizedQuery)) return true
    if (d.aliases.some(alias => alias.toLowerCase().includes(normalizedQuery))) return true
    
    return false
  })
}

// ── Initial Mock Data Seeding ──────────────────────────────────────────────

seedDiseases([
  {
    diseaseCode: 'D-WHEAT-RUST-01',
    name: 'Wheat Leaf Rust',
    aliases: ['Brown Rust'],
    crop: 'Wheat',
    diseaseCategory: DISEASE_CATEGORY.FUNGAL,
    symptoms: ['Small brown pustules on leaves', 'Orange-brown spores', 'Premature leaf death'],
    causes: 'Puccinia triticina fungus',
    severity: DISEASE_SEVERITY.HIGH,
    affectedPlantParts: ['Leaves', 'Leaf sheaths'],
    affectedGrowthStage: ['Tillering', 'Heading', 'Flowering'],
    environmentalConditions: {
      temperature: '15-22°C',
      humidity: 'High (Free moisture required)',
      rainfall: 'Frequent light rain',
      season: 'Rabi',
    },
    riskFactors: ['High nitrogen application', 'Susceptible varieties', 'Dense canopy'],
    treatment: {
      immediateActions: ['Isolate affected area if small', 'Avoid watering from above'],
      organicTreatment: 'Neem oil spray, Sulfur dust',
      chemicalTreatment: 'Propiconazole or Tebuconazole foliar spray',
      culturalPractices: ['Crop rotation', 'Remove volunteer wheat'],
      monitoring: 'Scout lower leaves weekly starting at tillering',
      expertConsultation: 'Consult KVK if chemical treatment fails',
    },
    prevention: ['Plant resistant varieties', 'Destroy volunteer wheat plants', 'Proper row spacing'],
    officialSources: [
      {
        title: 'ICAR Wheat Disease Management',
        url: 'https://icar.org.in',
        sourceType: 'gov',
        year: 2023,
      }
    ]
  },
  {
    diseaseCode: 'D-TOMATO-BLIGHT-01',
    name: 'Late Blight of Tomato',
    aliases: ['Phytophthora blight'],
    crop: 'Tomato',
    diseaseCategory: DISEASE_CATEGORY.FUNGAL,
    symptoms: ['Irregular water-soaked spots on leaves', 'White fungal growth on undersides', 'Brown firm lesions on fruit'],
    causes: 'Phytophthora infestans oomycete',
    severity: DISEASE_SEVERITY.CRITICAL,
    affectedPlantParts: ['Leaves', 'Stems', 'Fruit'],
    affectedGrowthStage: ['Vegetative', 'Fruiting'],
    environmentalConditions: {
      temperature: '15-20°C',
      humidity: '>90%',
      rainfall: 'Heavy continuous rain',
      season: 'Kharif',
    },
    riskFactors: ['Cool wet weather', 'Overhead irrigation', 'Proximity to infected potato fields'],
    treatment: {
      immediateActions: ['Remove and destroy infected plants immediately'],
      organicTreatment: 'Copper-based fungicides (preventative)',
      chemicalTreatment: 'Mancozeb or Chlorothalonil before severe infection',
      culturalPractices: ['Drip irrigation instead of overhead', 'Ensure good air circulation'],
      monitoring: 'Daily scouting during cool, wet periods',
      expertConsultation: 'Notify neighbors and local agronomist due to rapid spread',
    },
    prevention: ['Use certified disease-free seeds', 'Stake or cage plants', 'Apply preventative copper sprays'],
    officialSources: [
      {
        title: 'Tomato Disease Guide',
        url: 'https://nhb.gov.in',
        sourceType: 'gov',
        year: 2022,
      }
    ]
  }
])
