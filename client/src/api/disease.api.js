import axiosClient from './axiosClient.js'

/**
 * POST /api/v1/disease/analyze
 * Analyze crop disease from symptom metadata.
 */
export async function analyzeDisease(payload) {
  return axiosClient.post('/disease/analyze', {
    crop: payload.crop,
    plantPart: payload.plantPart ?? '',
    symptomDescription: payload.symptomDescription ?? '',
  })
}

/**
 * POST /api/v1/disease/image
 * Upload a leaf image for disease diagnosis.
 */
export async function uploadImage(file) {
  const formData = new FormData()
  formData.append('image', file)

  return axiosClient.post('/disease/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}
