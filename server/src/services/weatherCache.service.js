/**
 * Weather Cache — Phase 10.
 *
 * Simple in-memory TTL cache to avoid repeated external weather API calls
 * for the same location within the configured freshness window.
 *
 * Implementation notes:
 *   - In-memory Map with TTL (appropriate for internship-scale deployment).
 *   - Cache key includes provider + location + forecast days.
 *   - Expired entries are lazily evicted on access.
 *   - Cache is replaceable: swap this module for a Redis adapter in production.
 *   - Cached responses preserve the original fetchedAt timestamp and add
 *     cacheHit: true so the frontend can show accurate data age.
 *
 * Cache key format:
 *   "{provider}:{normalizedLocation}:{forecastDays}"
 *
 * TTL is read from config.weather.cacheTtlSeconds.
 */

import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── Internal store ────────────────────────────────────────────────────────────

const _cache = new Map() // key → { data, storedAt, expiresAt }

// ── Cache key helpers ─────────────────────────────────────────────────────────

/**
 * Normalize a location string for consistent cache key generation.
 * Lowercases, trims, and collapses whitespace.
 *
 * @param {string} location
 * @returns {string}
 */
function normalizeLocationKey(location) {
  return (location ?? 'unknown').toLowerCase().trim().replace(/\s+/g, '_')
}

/**
 * Build a cache key for a weather request.
 *
 * @param {object} params
 * @param {string} params.provider - Provider name (e.g. 'open-meteo', 'mock-weather')
 * @param {string} params.location - Location name or "lat,lon" string
 * @param {number} [params.days] - Forecast days
 * @returns {string}
 */
export function buildCacheKey({ provider, location, days }) {
  const loc = normalizeLocationKey(location)
  return `${provider ?? 'unknown'}:${loc}:${days ?? config.weather.forecastDays}`
}

// ── Cache operations ──────────────────────────────────────────────────────────

/**
 * Retrieve a cached weather result if it is still valid.
 * Returns null if not found or expired.
 *
 * @param {string} key - Cache key from buildCacheKey()
 * @returns {object|null} Cached weather data with cacheHit and originalFetchedAt, or null
 */
export function getFromCache(key) {
  const entry = _cache.get(key)
  if (!entry) return null

  const now = Date.now()
  if (now > entry.expiresAt) {
    _cache.delete(key)
    logger.debug('WeatherCache: entry expired', { key })
    return null
  }

  logger.debug('WeatherCache: cache hit', {
    key,
    ageSeconds: Math.floor((now - entry.storedAt) / 1000),
    remainingTtlSeconds: Math.floor((entry.expiresAt - now) / 1000),
  })

  // Return a copy with cache metadata added
  return {
    ...entry.data,
    metadata: {
      ...entry.data.metadata,
      cacheHit: true,
      originalFetchedAt: entry.data.metadata?.fetchedAt ?? null,
      fetchedAt: entry.data.metadata?.fetchedAt ?? null, // preserve original fetch time
      cachedAt: new Date(entry.storedAt).toISOString(),
    },
  }
}

/**
 * Store a weather result in the cache with TTL.
 *
 * @param {string} key - Cache key from buildCacheKey()
 * @param {object} data - Normalized weather data to cache
 */
export function setInCache(key, data) {
  const now = Date.now()
  const ttlMs = (config.weather.cacheTtlSeconds ?? 900) * 1000

  _cache.set(key, {
    data,
    storedAt: now,
    expiresAt: now + ttlMs,
  })

  logger.debug('WeatherCache: entry stored', {
    key,
    ttlSeconds: config.weather.cacheTtlSeconds,
  })
}

/**
 * Manually invalidate a cache entry.
 *
 * @param {string} key
 */
export function invalidateCache(key) {
  _cache.delete(key)
}

/**
 * Clear all cache entries. Intended for testing.
 */
export function clearCache() {
  _cache.clear()
}

/**
 * Return current cache stats for health/debug endpoints.
 *
 * @returns {{ size: number, ttlSeconds: number }}
 */
export function getCacheStats() {
  return {
    size: _cache.size,
    ttlSeconds: config.weather.cacheTtlSeconds,
  }
}
