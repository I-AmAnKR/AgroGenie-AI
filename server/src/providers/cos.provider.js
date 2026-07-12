/**
 * IBM Cloud Object Storage (COS) provider — Phase 7.
 *
 * Implements the storage provider interface:
 *   uploadObject(key, buffer, mimeType, metadata)
 *   listObjects(prefix, maxKeys)
 *   getObjectMetadata(key)
 *   getObjectStream(key)
 *   deleteObject(key)
 *   checkReadiness()
 *
 * Uses ibm-cos-sdk (AWS S3-compatible) with IAM authentication.
 * The SDK client is created once (singleton) and reused across requests.
 *
 * Credential safety:
 * - API key and resource instance ID are NEVER logged.
 * - SDK errors are mapped to safe application error codes before propagating.
 * - Raw SDK error objects are never returned to the frontend.
 */
import S3 from 'ibm-cos-sdk'
import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── Singleton client ──────────────────────────────────────────────────────────

let _client = null
let _readinessStatus = 'unknown' // 'connected' | 'unavailable' | 'not-configured' | 'unknown'

/**
 * Build and return the COS SDK client (singleton).
 * Throws STORAGE_CONFIGURATION_ERROR if required credentials are absent.
 */
function getClient() {
  if (_client) return _client

  const { apiKey, resourceInstanceId, endpoint, authEndpoint } = config.cos

  if (!apiKey) {
    const err = new Error('IBM_COS_API_KEY is not configured. Add it to server/.env.')
    err.code = 'STORAGE_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }
  if (!resourceInstanceId) {
    const err = new Error(
      'IBM_COS_RESOURCE_INSTANCE_ID is not configured. Add it to server/.env.'
    )
    err.code = 'STORAGE_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }
  if (!endpoint) {
    const err = new Error('IBM_COS_ENDPOINT is not configured. Add it to server/.env.')
    err.code = 'STORAGE_CONFIGURATION_ERROR'
    err.statusCode = 500
    throw err
  }

  _client = new S3.S3({
    endpoint,
    apiKeyId: apiKey,
    serviceInstanceId: resourceInstanceId,
    ibmAuthEndpoint: authEndpoint,
    signatureVersion: 'iam',
    s3ForcePathStyle: true,
  })

  // Never log apiKey or resourceInstanceId
  logger.info('IBM COS client initialized', {
    endpoint,
    bucket: config.cos.bucketName,
  })

  return _client
}

// ── Error mapping ─────────────────────────────────────────────────────────────

/**
 * Map SDK error to a safe application error.
 * Never expose raw SDK internals or credential information.
 *
 * @param {Error} err - Raw SDK/network error
 * @returns {Error} Application-level error with .code and .statusCode
 */
function mapSdkError(err) {
  const code = err.code ?? err.Code ?? ''
  const statusCode = err.statusCode ?? err.$metadata?.httpStatusCode ?? 0
  const message = err.message ?? ''

  const appErr = new Error()
  appErr.stack = err.stack

  if (code === 'InvalidAccessKeyId' || statusCode === 401 || message.includes('401')) {
    appErr.code = 'STORAGE_AUTH_ERROR'
    appErr.statusCode = 502
    appErr.message = 'COS authentication failed. Verify IBM_COS_API_KEY and IBM_COS_RESOURCE_INSTANCE_ID.'
    _readinessStatus = 'unavailable'
    return appErr
  }
  if (code === 'AccessDenied' || statusCode === 403) {
    appErr.code = 'STORAGE_ACCESS_DENIED'
    appErr.statusCode = 502
    appErr.message = 'COS access denied. Verify IAM permissions for the bucket.'
    _readinessStatus = 'unavailable'
    return appErr
  }
  if (code === 'NoSuchBucket') {
    appErr.code = 'BUCKET_NOT_FOUND'
    appErr.statusCode = 502
    appErr.message = `COS bucket "${config.cos.bucketName}" not found. Verify IBM_COS_BUCKET_NAME.`
    _readinessStatus = 'unavailable'
    return appErr
  }
  if (code === 'NoSuchKey' || statusCode === 404) {
    appErr.code = 'OBJECT_NOT_FOUND'
    appErr.statusCode = 404
    appErr.message = 'The requested document was not found in storage.'
    return appErr
  }
  if (code === 'RequestTimeout' || message.includes('ETIMEDOUT') || message.includes('ECONNABORTED')) {
    appErr.code = 'STORAGE_PROVIDER_ERROR'
    appErr.statusCode = 504
    appErr.message = 'COS request timed out.'
    return appErr
  }
  if (statusCode >= 500) {
    appErr.code = 'STORAGE_PROVIDER_ERROR'
    appErr.statusCode = 502
    appErr.message = 'COS provider is temporarily unavailable.'
    _readinessStatus = 'unavailable'
    return appErr
  }

  appErr.code = 'STORAGE_PROVIDER_ERROR'
  appErr.statusCode = 502
  appErr.message = 'An unexpected storage provider error occurred.'
  return appErr
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const cosProvider = {
  /**
   * Upload a buffer to COS.
   *
   * @param {string} key - Object key (path in bucket)
   * @param {Buffer} buffer - File content
   * @param {string} mimeType - MIME type for Content-Type header
   * @param {object} [objectMetadata={}] - Custom metadata key-value pairs
   * @returns {Promise<{key, bucket, eTag, size}>}
   */
  async uploadObject(key, buffer, mimeType, objectMetadata = {}) {
    const client = getClient()
    const bucket = config.cos.bucketName

    if (!bucket) {
      const err = new Error('IBM_COS_BUCKET_NAME is not configured.')
      err.code = 'STORAGE_CONFIGURATION_ERROR'
      err.statusCode = 500
      throw err
    }

    logger.debug('COS uploadObject', { key, bucket, size: buffer.length, mimeType })

    try {
      const response = await client
        .putObject({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          ContentLength: buffer.length,
          Metadata: objectMetadata,
        })
        .promise()

      _readinessStatus = 'connected'
      return {
        key,
        bucket,
        eTag: response.ETag ?? null,
        size: buffer.length,
      }
    } catch (err) {
      logger.error('COS uploadObject error', {
        httpStatus: err.statusCode ?? err.$metadata?.httpStatusCode ?? 'N/A',
        errorCode: err.code ?? err.Code ?? 'UNKNOWN',
        errorMessage: err.message ?? 'No message provided',
        bucket,
        key,
        endpoint: config.cos.endpoint,
        region: config.cos.endpoint ? config.cos.endpoint.split('.')[1] : 'unknown',
        rawError: err,
      })
      throw mapSdkError(err)
    }
  },

  /**
   * List objects in the bucket, optionally filtered by prefix.
   *
   * @param {string} [prefix=''] - Key prefix to filter results
   * @param {number} [maxKeys=100] - Maximum number of results
   * @returns {Promise<Array<{key, size, lastModified, eTag}>>}
   */
  async listObjects(prefix = '', maxKeys = 100) {
    const client = getClient()
    const bucket = config.cos.bucketName

    logger.debug('COS listObjects', { prefix, maxKeys, bucket })

    try {
      const response = await client
        .listObjectsV2({
          Bucket: bucket,
          Prefix: prefix,
          MaxKeys: maxKeys,
        })
        .promise()

      _readinessStatus = 'connected'
      return (response.Contents ?? []).map((obj) => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
        eTag: obj.ETag,
      }))
    } catch (err) {
      logger.error('COS listObjects error', {
        httpStatus: err.statusCode ?? err.$metadata?.httpStatusCode ?? 'N/A',
        errorCode: err.code ?? err.Code ?? 'UNKNOWN',
        errorMessage: err.message ?? 'No message provided',
        bucket,
        prefix,
        endpoint: config.cos.endpoint,
        region: config.cos.endpoint ? config.cos.endpoint.split('.')[1] : 'unknown',
        rawError: err,
      })
      throw mapSdkError(err)
    }
  },

  /**
   * Get metadata headers for an object without downloading the body.
   *
   * @param {string} key - Object key
   * @returns {Promise<{key, size, mimeType, lastModified, metadata}>}
   */
  async getObjectMetadata(key) {
    const client = getClient()
    const bucket = config.cos.bucketName

    logger.debug('COS getObjectMetadata', { key, bucket })

    try {
      const response = await client
        .headObject({ Bucket: bucket, Key: key })
        .promise()

      return {
        key,
        size: response.ContentLength,
        mimeType: response.ContentType,
        lastModified: response.LastModified,
        metadata: response.Metadata ?? {},
      }
    } catch (err) {
      logger.error('COS getObjectMetadata error', {
        httpStatus: err.statusCode ?? err.$metadata?.httpStatusCode ?? 'N/A',
        errorCode: err.code ?? err.Code ?? 'UNKNOWN',
        errorMessage: err.message ?? 'No message provided',
        bucket,
        key,
        endpoint: config.cos.endpoint,
        region: config.cos.endpoint ? config.cos.endpoint.split('.')[1] : 'unknown',
        rawError: err,
      })
      throw mapSdkError(err)
    }
  },

  /**
   * Get a readable stream for an object.
   * The caller is responsible for consuming/closing the stream.
   *
   * @param {string} key - Object key
   * @returns {Promise<ReadableStream>}
   */
  async getObjectStream(key) {
    const client = getClient()
    const bucket = config.cos.bucketName

    logger.debug('COS getObjectStream', { key, bucket })

    try {
      // createReadStream() does NOT throw on missing key — it emits an error event.
      // We use getObject().createReadStream() which integrates with piping.
      const stream = client.getObject({ Bucket: bucket, Key: key }).createReadStream()
      return stream
    } catch (err) {
      logger.error('COS getObjectStream error', {
        httpStatus: err.statusCode ?? err.$metadata?.httpStatusCode ?? 'N/A',
        errorCode: err.code ?? err.Code ?? 'UNKNOWN',
        errorMessage: err.message ?? 'No message provided',
        bucket,
        key,
        endpoint: config.cos.endpoint,
        region: config.cos.endpoint ? config.cos.endpoint.split('.')[1] : 'unknown',
        rawError: err,
      })
      throw mapSdkError(err)
    }
  },

  /**
   * Delete an object from the bucket.
   *
   * @param {string} key - Object key
   * @returns {Promise<{key, deleted: boolean}>}
   */
  async deleteObject(key) {
    const client = getClient()
    const bucket = config.cos.bucketName

    logger.debug('COS deleteObject', { key, bucket })

    try {
      await client.deleteObject({ Bucket: bucket, Key: key }).promise()

      logger.info('COS object deleted', { key, bucket })
      return { key, deleted: true }
    } catch (err) {
      logger.error('COS deleteObject error', {
        httpStatus: err.statusCode ?? err.$metadata?.httpStatusCode ?? 'N/A',
        errorCode: err.code ?? err.Code ?? 'UNKNOWN',
        errorMessage: err.message ?? 'No message provided',
        bucket,
        key,
        endpoint: config.cos.endpoint,
        region: config.cos.endpoint ? config.cos.endpoint.split('.')[1] : 'unknown',
        rawError: err,
      })
      throw mapSdkError(err)
    }
  },

  /**
   * Lightweight readiness check — lists max 1 object.
   * Does NOT upload a test object.
   *
   * @returns {Promise<'connected'|'unavailable'>}
   */
  async checkReadiness() {
    if (_readinessStatus === 'connected') return 'connected'

    try {
      const client = getClient()
      const bucket = config.cos.bucketName
      if (!bucket) return 'not-configured'

      await client.listObjectsV2({ Bucket: bucket, MaxKeys: 1 }).promise()
      _readinessStatus = 'connected'
      return 'connected'
    } catch {
      _readinessStatus = 'unavailable'
      return 'unavailable'
    }
  },

  /**
   * Return cached readiness status without a live check.
   * Safe to call on every health request.
   *
   * @returns {'connected'|'unavailable'|'not-configured'|'unknown'}
   */
  getHealthStatus() {
    try {
      const { apiKey, resourceInstanceId, endpoint, bucketName } = config.cos
      if (!apiKey || !resourceInstanceId || !endpoint || !bucketName) {
        return 'not-configured'
      }
      // Return the cached status set by real operations; 'unknown' before first use
      return _readinessStatus === 'unknown' ? 'not-configured' : _readinessStatus
    } catch {
      return 'unavailable'
    }
  },
}
