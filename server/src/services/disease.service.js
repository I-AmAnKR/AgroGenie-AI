/**
 * Disease advisory service — Phase 15A.
 *
 * Provides robust disease knowledge abstraction using verified profiles
 * and RAG integration. Image analysis and diagnosis will be in Phase 16.
 */
import * as diseaseRepo from '../repositories/disease.repository.js'
import { searchKnowledge } from './rag.service.js'
import logger from '../utils/logger.js'



/**
 * Get verified disease knowledge by crop and disease name/alias.
 * Optionally integrates with RAG for deep knowledge.
 *
 * @param {string} cropCode 
 * @param {string} diseaseName 
 * @param {boolean} includeRag 
 * @returns {Promise<object>} Combined disease profile and RAG sources
 */
export async function getDiseaseKnowledge(cropCode, diseaseName, includeRag = false) {
  // Try to find the exact disease profile
  const diseasesForCrop = diseaseRepo.findByCrop(cropCode)
  const profile = diseasesForCrop.find(d => 
    d.name.toLowerCase() === diseaseName.toLowerCase() || 
    d.aliases.some(a => a.toLowerCase() === diseaseName.toLowerCase())
  ) || null

  let ragContext = []
  if (includeRag && profile) {
    try {
      // Search RAG for deeper treatment/management data using metadata filters
      ragContext = await searchKnowledge({
        query: `Management and treatment for ${profile.name} in ${profile.crop}`,
        filters: {
          category: 'disease',
          crop: profile.crop,
          diseaseCode: profile.diseaseCode
        }
      })
    } catch (err) {
      logger.warn('Failed to retrieve RAG context for disease', {
        diseaseName,
        error: err.message
      })
    }
  }

  return {
    profile,
    ragContext
  }
}

/**
 * Search disease profiles by text query.
 * @param {string} query 
 * @returns {object[]} Array of matching disease profiles
 */
export function searchDiseaseProfiles(query) {
  return diseaseRepo.searchByNameOrAlias(query)
}

/**
 * Find diseases by matching a symptom keyword.
 * @param {string} symptomKeyword 
 * @returns {object[]} Array of matching disease profiles
 */
export function findDiseasesBySymptom(symptomKeyword) {
  return diseaseRepo.findBySymptom(symptomKeyword)
}

/**
 * Legacy Phase 9 compatibility wrapper.
 * Analyze crop disease from metadata.
 * @param {object} params - { crop, plantPart, symptomDescription }
 */
export async function analyzeDisease(params = {}) {
  // For Phase 15A, we return a structured "not available" or basic symptom match
  // without diagnosing.
  const { crop, symptomDescription } = params
  let matches = []
  
  if (crop && symptomDescription) {
    // Basic keyword extraction (simplified for Phase 15A)
    const keywords = symptomDescription.split(' ').filter(w => w.length > 4)
    for (const kw of keywords) {
      const found = diseaseRepo.findBySymptom(kw).filter(d => d.crop.toLowerCase() === crop.toLowerCase())
      matches.push(...found)
    }
  }
  
  // Deduplicate matches
  matches = [...new Map(matches.map(item => [item.diseaseCode, item])).values()]

  return {
    status: 'capability_not_available',
    message: 'Disease diagnosis from symptoms/images is scheduled for Phase 16. Please consult an agronomist.',
    potentialMatches: matches,
  }
}

