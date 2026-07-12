import axiosClient from './axiosClient.js'

/**
 * POST /api/v1/crop-recommendation
 * Get crop recommendations based on farm parameters.
 */
export async function getCropRecommendations(payload) {
  return axiosClient.post('/crop-recommendation', {
    state: payload.state,
    district: payload.district ?? '',
    season: payload.season,
    soilType: payload.soilType,
    irrigationAvailability: payload.irrigation ?? payload.irrigationAvailability ?? '',
    farmArea: payload.farmArea ?? null,
    farmAreaUnit: payload.areaUnit ?? 'acres',
    budgetRange: payload.budget ?? '',
    previousCrop: payload.previousCrop ?? '',
    currentCrop: payload.currentCrop ?? '',
    objective: payload.objective ?? 'balanced',
  })
}
