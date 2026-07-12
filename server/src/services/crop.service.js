/**
 * Crop recommendation service.
 * Delegates to mock provider.
 * Will use IBM Granite + RAG in Phase 13.
 */
import { mockCropRecommendations } from '../data/mock/cropRecommendations.js'

/**
 * Get crop recommendations based on farm parameters.
 * @param {object} params - Farm input parameters
 */
export async function getCropRecommendations(params) {
  // In Phase 13 this will call the Crop Advisor agent via the Agent Router.
  // For Phase 4 we return mock recommendations regardless of input.
  return {
    recommendations: mockCropRecommendations,
    context: {
      state: params.state,
      district: params.district ?? '',
      season: params.season,
      soilType: params.soilType,
      irrigationAvailability: params.irrigationAvailability ?? params.irrigation ?? '',
      objective: params.objective,
    },
    missingInformation: buildMissingInfo(params),
    warnings: [],
    generatedAt: new Date().toISOString(),
    isDemo: true,
  }
}

function buildMissingInfo(params) {
  const missing = []
  if (!params.district) missing.push('District not provided — recommendations are generalised for the state')
  if (!params.farmArea) missing.push('Farm area not provided')
  if (!params.previousCrop && !params.currentCrop) missing.push('Crop history not provided — rotation advice is limited')
  return missing
}
