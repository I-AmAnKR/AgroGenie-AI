/**
 * Mock Storage Provider — Phase 7.
 *
 * In-memory implementation of the storage provider contract.
 * Zero IBM credentials required.
 * Used when USE_MOCK_PROVIDERS=true.
 *
 * Implements same interface as cosProvider:
 *   uploadObject(), listObjects(), getObjectMetadata(),
 *   getObjectStream(), deleteObject(), checkReadiness()
 */
import { Readable } from 'stream'

// In-memory store: key → { buffer, mimeType, metadata, uploadedAt, size }
const _store = new Map()

export const mockStorageProvider = {
  /**
   * Store a buffer in memory.
   *
   * @param {string} key
   * @param {Buffer} buffer
   * @param {string} mimeType
   * @param {object} [objectMetadata={}]
   * @returns {Promise<{key, bucket, eTag, size}>}
   */
  async uploadObject(key, buffer, mimeType, objectMetadata = {}) {
    _store.set(key, {
      buffer,
      mimeType,
      metadata: objectMetadata,
      uploadedAt: new Date(),
      size: buffer.length,
    })

    return {
      key,
      bucket: 'mock-bucket',
      eTag: `"mock-etag-${Date.now()}"`,
      size: buffer.length,
    }
  },

  /**
   * List stored keys, optionally filtered by prefix.
   *
   * @param {string} [prefix='']
   * @param {number} [maxKeys=100]
   * @returns {Promise<Array<{key, size, lastModified, eTag}>>}
   */
  async listObjects(prefix = '', maxKeys = 100) {
    const results = []
    for (const [key, obj] of _store.entries()) {
      if (prefix && !key.startsWith(prefix)) continue
      results.push({
        key,
        size: obj.size,
        lastModified: obj.uploadedAt,
        eTag: `"mock-etag-${key}"`,
      })
      if (results.length >= maxKeys) break
    }
    return results
  },

  /**
   * Get metadata for a stored object.
   *
   * @param {string} key
   * @returns {Promise<{key, size, mimeType, lastModified, metadata}>}
   */
  async getObjectMetadata(key) {
    const obj = _store.get(key)
    if (!obj) {
      const err = new Error('Object not found in mock storage.')
      err.code = 'OBJECT_NOT_FOUND'
      err.statusCode = 404
      throw err
    }
    return {
      key,
      size: obj.size,
      mimeType: obj.mimeType,
      lastModified: obj.uploadedAt,
      metadata: obj.metadata,
    }
  },

  /**
   * Return a Readable stream for a stored object.
   *
   * @param {string} key
   * @returns {Promise<Readable>}
   */
  async getObjectStream(key) {
    const obj = _store.get(key)
    if (!obj) {
      const err = new Error('Object not found in mock storage.')
      err.code = 'OBJECT_NOT_FOUND'
      err.statusCode = 404
      throw err
    }
    return Readable.from(obj.buffer)
  },

  /**
   * Delete a stored object.
   *
   * @param {string} key
   * @returns {Promise<{key, deleted: boolean}>}
   */
  async deleteObject(key) {
    _store.delete(key)
    return { key, deleted: true }
  },

  /**
   * Mock readiness — always ready.
   *
   * @returns {Promise<'connected'>}
   */
  async checkReadiness() {
    return 'connected'
  },

  /**
   * Health status — always mock.
   *
   * @returns {'mock'}
   */
  getHealthStatus() {
    return 'mock'
  },

  /**
   * Test helper — clear all stored objects.
   * Not part of the public storage contract.
   */
  _clear() {
    _store.clear()
  },

  /**
   * Test helper — check if a key exists.
   * Not part of the public storage contract.
   */
  _has(key) {
    return _store.has(key)
  },
}
