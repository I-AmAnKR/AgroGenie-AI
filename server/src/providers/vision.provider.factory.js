import config from '../config/env.js'
import logger from '../utils/logger.js'
import { analyzeImage as mockAnalyzeImage } from './mock/mock-vision.provider.js'
import { analyzeImage as realAnalyzeImage } from './vision.provider.js'

/**
 * Get the vision provider implementation based on configuration.
 *
 * @returns {object} Provider with analyzeImage(objectKey, mimeType)
 */
export function getVisionProvider() {
  if (config.providers.useMocks) {
    logger.debug('VisionProviderFactory: Using MOCK provider')
    return { analyzeImage: mockAnalyzeImage }
  }

  logger.debug('VisionProviderFactory: Using REAL provider')
  return { analyzeImage: realAnalyzeImage }
}
