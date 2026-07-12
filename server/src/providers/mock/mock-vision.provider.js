import logger from '../../utils/logger.js'

/**
 * Mock vision provider for Phase 15C.
 * Simulates analyzing an image to extract candidate symptoms.
 *
 * @param {string} objectKey
 * @param {string} mimeType
 * @returns {Promise<Array<string>>} List of candidate symptoms detected
 */
export async function analyzeImage(objectKey, mimeType) {
  logger.info('MockVisionProvider: analyzing image', { objectKey, mimeType })
  
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300))

  // Very basic deterministic mocking based on filename matching
  const key = objectKey.toLowerCase()
  if (key.includes('blight')) {
    return ['brown spots', 'yellow halos', 'leaf curling']
  }
  if (key.includes('rust')) {
    return ['orange pustules', 'yellowing leaves']
  }
  if (key.includes('rot')) {
    return ['mushy roots', 'black stem base']
  }

  // Default fallback symptoms if no specific keyword
  return ['yellowing leaves', 'stunted growth']
}
