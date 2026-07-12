import config from '../config/env.js'
import { mockImageProvider } from './mock/mock-image.provider.js'
import { imageProvider } from './image.provider.js'

/**
 * Image Provider Factory — Phase 15B.
 * 
 * Selects between the Mock Image Provider and the real Image Provider
 * depending on the `USE_MOCK_PROVIDERS` configuration.
 *
 * @returns {object} Active image provider implementing `uploadImage(buffer, mimeType, originalName)`
 */
export function getImageProvider() {
  if (config.providers.useMocks) {
    return mockImageProvider
  }
  
  return imageProvider
}
