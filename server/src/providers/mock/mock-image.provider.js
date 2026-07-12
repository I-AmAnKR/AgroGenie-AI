import crypto from 'crypto'
import sizeOf from 'image-size'
import { v4 as uuidv4 } from 'uuid'
import logger from '../../utils/logger.js'

/**
 * Mock Image Provider for Phase 15B.
 * Extracts metadata, generates hashes and unique keys, but doesn't store anything.
 */
export const mockImageProvider = {
  /**
   * Upload an image (Mock)
   * 
   * @param {Buffer} buffer - Image buffer
   * @param {string} mimeType - Image MIME type
   * @param {string} originalName - Original filename
   * @returns {Promise<object>} Metadata matching the real provider
   */
  async uploadImage(buffer, mimeType, originalName) {
    const id = uuidv4()
    // Sanitize filename
    const base = originalName.split(/[\\/]/).pop() ?? 'image'
    const safeName = base.toLowerCase().replace(/[^a-z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 100)
    
    // Store under disease-images/ as requested
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
      logger.warn('Failed to extract image dimensions in mock provider', { error: err.message })
    }

    logger.info('Mock image upload simulated', {
      key: objectKey,
      size: buffer.length,
      mimeType,
      hash,
    })

    return {
      objectKey,
      bucket: 'mock-agrogenie-bucket',
      mimeType,
      size: buffer.length,
      width,
      height,
      sha256: hash,
      uploadedAt: new Date().toISOString(),
    }
  }
}
