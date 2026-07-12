import crypto from 'crypto'
import sizeOf from 'image-size'
import { v4 as uuidv4 } from 'uuid'
import { getStorageProvider } from './storage.provider.factory.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

/**
 * Image Provider for Phase 15B.
 * Uses the underlying Storage Provider (COS) to upload images to the `disease-images/` bucket path.
 * Extracts metadata (dimensions, sha256) and returns it without public URLs.
 */
export const imageProvider = {
  /**
   * Upload an image to IBM COS
   * 
   * @param {Buffer} buffer - Image buffer
   * @param {string} mimeType - Image MIME type
   * @param {string} originalName - Original filename
   * @returns {Promise<object>} Metadata matching the Phase 15B requirements
   */
  async uploadImage(buffer, mimeType, originalName) {
    const id = uuidv4()
    // Sanitize filename
    const base = originalName.split(/[\\/]/).pop() ?? 'image'
    const safeName = base.toLowerCase().replace(/[^a-z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 100)
    
    // Store under disease-images/
    const objectKey = `disease-images/${id}-${safeName}`
    
    // Calculate SHA-256 hash for duplicate detection
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')
    
    // Extract dimensions using image-size
    let width = null
    let height = null
    try {
      const dimensions = sizeOf(buffer)
      width = dimensions.width
      height = dimensions.height
    } catch (err) {
      logger.warn('Failed to extract image dimensions', { error: err.message, objectKey })
    }

    const storageProvider = getStorageProvider()
    
    // Upload object to COS
    // getStorageProvider throws if misconfigured or if upload fails
    const uploadResult = await storageProvider.uploadObject(
      objectKey,
      buffer,
      mimeType,
      {
        originalname: safeName,
        sha256: hash
      }
    )

    logger.info('Image uploaded to COS successfully', {
      key: objectKey,
      size: buffer.length,
      mimeType,
    })

    return {
      objectKey,
      bucket: uploadResult.bucket ?? config.cos.bucketName,
      mimeType,
      size: buffer.length,
      width,
      height,
      sha256: hash,
      uploadedAt: new Date().toISOString(),
    }
  }
}
