import logger from '../utils/logger.js'
import config from '../config/env.js'

export const CONFIDENCE_LEVELS = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  NEEDS_EXPERT_REVIEW: 'Needs Expert Review',
}

/**
 * Score a disease candidate based on image symptoms, weather, and crop profile.
 * 
 * @param {object} disease Profile from repo
 * @param {Array<string>} candidateSymptoms Detected by vision provider
 * @param {object} weather Weather context
 * @param {object} cropProfile Crop context
 * @returns {object} Scored candidate
 */
function scoreCandidate(disease, candidateSymptoms, weather, cropProfile) {
  let score = 0
  let matches = []
  let weatherRisk = false

  // 1. Symptom matching (max 60 points)
  if (disease.symptoms && candidateSymptoms.length > 0) {
    const symptomMatchCount = candidateSymptoms.filter(sym => 
      disease.symptoms.some(ds => ds.toLowerCase().includes(sym.toLowerCase()) || sym.toLowerCase().includes(ds.toLowerCase()))
    ).length
    
    // Each matched symptom gives some points up to 60
    const symptomScore = Math.min(60, (symptomMatchCount / Math.max(1, candidateSymptoms.length)) * 60)
    score += symptomScore
    if (symptomMatchCount > 0) matches.push('Image symptoms match known disease symptoms')
  }

  // 2. Weather conditions matching (max 25 points)
  if (weather && weather.current && disease.environmentalConditions) {
    const { temperature, humidity } = disease.environmentalConditions
    let weatherScore = 0
    let tempMatch = false
    let humidMatch = false
    
    if (temperature && weather.current.tempC !== undefined) {
      if (weather.current.tempC >= (temperature.min || 0) && weather.current.tempC <= (temperature.max || 100)) {
        weatherScore += 12.5
        tempMatch = true
      }
    }
    
    if (humidity && weather.current.humidity !== undefined) {
      if (weather.current.humidity >= (humidity.min || 0) && weather.current.humidity <= (humidity.max || 100)) {
        weatherScore += 12.5
        humidMatch = true
      }
    }
    
    score += weatherScore
    if (tempMatch || humidMatch) {
      matches.push('Current weather is favorable for this disease')
      weatherRisk = true
    }
  }

  // 3. Crop context matching (max 15 points)
  if (cropProfile && disease.crop) {
    if (disease.crop.toLowerCase() === cropProfile.name?.toLowerCase()) {
      score += 15
      matches.push('Affects the specific crop planted')
    }
  } else {
    // If no crop context provided, assume neutral score 10
    score += 10
  }

  const normalizedScore = Math.min(100, Math.round(score))

  let level = CONFIDENCE_LEVELS.LOW
  const minConfidence = config.disease?.minConfidence || 65

  if (normalizedScore < minConfidence) {
    level = CONFIDENCE_LEVELS.NEEDS_EXPERT_REVIEW
  } else if (normalizedScore >= 85) {
    level = CONFIDENCE_LEVELS.HIGH
  } else if (normalizedScore >= 75) {
    level = CONFIDENCE_LEVELS.MEDIUM
  } else {
    level = CONFIDENCE_LEVELS.LOW
  }

  return {
    diseaseCode: disease.diseaseCode,
    disease,
    confidence: normalizedScore,
    confidenceLevel: level,
    supportingEvidence: matches,
    progressionRisk: weatherRisk ? 'HIGH (Weather conditions favor rapid spread)' : 'NORMAL',
  }
}

/**
 * Determine the primary disease and alternatives from a list of diseases matching symptoms.
 * 
 * @param {Array<object>} diseases 
 * @param {Array<string>} candidateSymptoms 
 * @param {object} weather 
 * @param {object} cropProfile 
 * @returns {object} { primaryDisease, alternatives }
 */
export function determineDiseaseAdvisory(diseases, candidateSymptoms, weather, cropProfile) {
  if (!diseases || diseases.length === 0) {
    return { primaryDisease: null, alternatives: [] }
  }

  const scored = diseases.map(d => scoreCandidate(d, candidateSymptoms, weather, cropProfile))
  
  // Sort descending by score
  scored.sort((a, b) => b.confidence - a.confidence)

  const primaryDisease = scored[0]
  const alternatives = scored.slice(1, 4) // Top 3 alternatives

  return { primaryDisease, alternatives }
}
