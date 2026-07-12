import logger from '../utils/logger.js'

/**
 * Real vision provider for Phase 15C (Placeholder).
 * In a future phase, this will connect to Watsonx Vision or another VLM
 * to extract symptoms from the image.
 *
 * @param {string} objectKey
 * @param {string} mimeType
 * @returns {Promise<Array<string>>}
 */
export async function analyzeImage(objectKey, mimeType) {
  logger.warn('Real VisionProvider called but not yet fully implemented for Phase 15C', { objectKey })
  
  // As a fallback for Phase 15C real mode without a VLM,
  // we just return generic symptoms so the pipeline doesn't crash.
  return ['yellowing leaves', 'spots']
}
