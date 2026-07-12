/**
 * Storage Provider Factory — Phase 7.
 *
 * Single location for storage provider selection.
 * No scattered process.env checks in controllers or services.
 *
 * Provider selection:
 *   USE_MOCK_PROVIDERS=true  → MockStorageProvider (in-memory, zero credentials)
 *   USE_MOCK_PROVIDERS=false → COSProvider (real IBM Cloud Object Storage)
 *
 * If real mode is selected but the required COS configuration is absent,
 * this throws STORAGE_CONFIGURATION_ERROR rather than silently falling back
 * to mock. Silent fallback would hide misconfiguration in production.
 */
import config from '../config/env.js'
import { mockStorageProvider } from './mock/mock-storage.provider.js'
import { cosProvider } from './cos.provider.js'

/**
 * Return the configured storage provider instance.
 *
 * @throws {Error} STORAGE_CONFIGURATION_ERROR when real mode is selected without valid config.
 * @returns {object} Active storage provider implementing the storage interface.
 */
export function getStorageProvider() {
  if (config.providers.useMocks) {
    return mockStorageProvider
  }

  // Real mode — validate required config before returning the provider.
  const { apiKey, resourceInstanceId, endpoint, bucketName } = config.cos
  if (!apiKey || !resourceInstanceId || !endpoint || !bucketName) {
    const err = new Error(
      'USE_MOCK_PROVIDERS=false requires IBM_COS_API_KEY, IBM_COS_RESOURCE_INSTANCE_ID, ' +
        'IBM_COS_ENDPOINT, and IBM_COS_BUCKET_NAME. ' +
        'Set them in server/.env or set USE_MOCK_PROVIDERS=true for demo mode.'
    )
    err.code = 'STORAGE_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  return cosProvider
}

/**
 * Return the storage health status without a live COS check.
 * Safe to call on every health request.
 *
 * @returns {'mock'|'connected'|'unavailable'|'not-configured'}
 */
export function getStorageHealthStatus() {
  if (config.providers.useMocks) return 'mock'

  const { apiKey, resourceInstanceId, endpoint, bucketName } = config.cos
  if (!apiKey || !resourceInstanceId || !endpoint || !bucketName) {
    return 'not-configured'
  }

  const providerStatus = cosProvider.getHealthStatus()
  return providerStatus === 'unknown' || providerStatus === 'not-configured'
    ? 'connected'
    : providerStatus
}
