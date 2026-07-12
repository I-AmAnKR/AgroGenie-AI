/**
 * Market Cache — Phase 11.
 *
 * Simple in-memory TTL cache to avoid repeated external market API calls
 * for the same commodity/location within the configured freshness window.
 *
 * Architecture mirrors weatherCache.service.js — same contract, different namespace.
 *
 * Cache key format:
 *   "{provider}:{commodity}:{state}:{district}:{market}:{queryType}"
 *
 * TTL is read from config.market.cacheTtlSeconds (default 1800 s = 30 min).
 */

import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── Internal store ────────────────────────────────────────────────────────────

const _cache = new Map() // key → { data, storedAt, expiresAt }

// ── Key helpers ───────────────────────────────────────────────────────────────

/**
 * Normalize a component string for cache key generation.
 *
 * @param {string|null|undefined} val
 * @returns {string}
 */
function norm(val) {
  return (val ?? 'any').toLowerCase().trim().replace(/\s+/g, '_')
}

/**
 * Build a market cache key.
 *
 * @param {object} params
 * @param {string} params.provider
 * @param {string} params.commodity
 * @param {string|null} [params.state]
 * @param {string|null} [params.district]
 * @param {string|null} [params.market]
 * @param {string} [params.queryType]
 * @returns {string}
 */
export function buildMarketCacheKey({ provider, commodity, state, district, market, queryType }) {
  return [
    norm(provider),
    norm(commodity),
    norm(state),
    norm(district),
    norm(market),
    norm(queryType),
  ].join(':')
}

// ── Cache operations ──────────────────────────────────────────────────────────

/**
 * Retrieve a cached market result if still valid.
 * Returns null if not found or expired.
 *
 * @param {string} key
 * @returns {object|null}
 */
export function getMarketFromCache(key) {
  const entry = _cache.get(key)
  if (!entry) return null

  const now = Date.now()
  if (now > entry.expiresAt) {
    _cache.delete(key)
    logger.debug('MarketCache: entry expired', { key })
    return null
  }

  logger.debug('MarketCache: cache hit', {
    key,
    ageSeconds: Math.floor((now - entry.storedAt) / 1000),
    remainingTtlSeconds: Math.floor((entry.expiresAt - now) / 1000),
  })

  return {
    ...entry.data,
    metadata: {
      ...entry.data.metadata,
      cacheHit: true,
      originalFetchedAt: entry.data.metadata?.fetchedAt ?? null,
      fetchedAt: entry.data.metadata?.fetchedAt ?? null,
      cachedAt: new Date(entry.storedAt).toISOString(),
    },
  }
}

/**
 * Store a market result in the cache with TTL.
 *
 * @param {string} key
 * @param {object} data - Normalized market data to cache
 */
export function setMarketInCache(key, data) {
  const now = Date.now()
  const ttlMs = (config.market.cacheTtlSeconds ?? 1800) * 1000

  _cache.set(key, {
    data,
    storedAt: now,
    expiresAt: now + ttlMs,
  })

  logger.debug('MarketCache: entry stored', {
    key,
    ttlSeconds: config.market.cacheTtlSeconds,
  })
}

/**
 * Manually invalidate a cache entry.
 *
 * @param {string} key
 */
export function invalidateMarketCache(key) {
  _cache.delete(key)
}

/**
 * Clear all market cache entries. Intended for testing.
 */
export function clearMarketCache() {
  _cache.clear()
}

/**
 * Return current market cache stats for health/debug endpoints.
 *
 * @returns {{ size: number, ttlSeconds: number }}
 */
export function getMarketCacheStats() {
  return {
    size: _cache.size,
    ttlSeconds: config.market.cacheTtlSeconds,
  }
}
