/**
 * Scheme repository — Phase 12.
 *
 * Raw MongoDB driver operations on the `schemes` collection.
 * No Mongoose — consistent with Phase 5 / Phase 7 architecture.
 *
 * In-memory fallback:
 *   When MongoDB is not available (tests / no-DB mode), an in-memory Map
 *   is used — matching the knowledgeDocument.repository.js pattern.
 *
 * Architecture:
 *   Scheme Agent → Scheme Service → Scheme Repository → MongoDB
 *
 * Controllers and agents must not call this repository directly.
 * All access goes through schemes.service.js.
 */
import { getDb } from '../services/db.service.js'
import logger from '../utils/logger.js'

const COLLECTION = 'schemes'

// In-memory store: schemeId → scheme record
const _memStore = new Map()

// ── Collection accessor ───────────────────────────────────────────────────────

function getCollection() {
  try {
    return getDb().collection(COLLECTION)
  } catch {
    return null
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Insert a new scheme record.
 *
 * @param {object} scheme - Scheme record from createSchemeRecord()
 * @returns {Promise<object>} The inserted scheme (without MongoDB _id)
 */
export async function createScheme(scheme) {
  const col = getCollection()
  try {
    if (col) {
      await col.insertOne({ ...scheme })
    } else {
      _memStore.set(scheme.schemeId, { ...scheme })
    }
    logger.debug('Scheme created', { schemeId: scheme.schemeId, schemeCode: scheme.schemeCode })
    return scheme
  } catch (err) {
    logger.error('Scheme insert failed', { error: err.message })
    const appErr = new Error('Failed to persist scheme record.')
    appErr.code = 'SCHEME_PERSISTENCE_ERROR'
    appErr.statusCode = 500
    throw appErr
  }
}

/**
 * Update an existing scheme record.
 * Only updates the fields supplied in `updates`; always advances updatedAt.
 *
 * @param {string} schemeId
 * @param {object} updates
 * @returns {Promise<boolean>} true if a document was modified
 */
export async function updateScheme(schemeId, updates) {
  const now = new Date().toISOString()
  const col = getCollection()
  try {
    if (col) {
      const result = await col.updateOne(
        { schemeId },
        { $set: { ...updates, updatedAt: now } }
      )
      return result.matchedCount > 0
    }
    const doc = _memStore.get(schemeId)
    if (!doc) return false
    Object.assign(doc, updates, { updatedAt: now })
    return true
  } catch (err) {
    logger.error('Scheme update failed', { schemeId, error: err.message })
    const appErr = new Error('Failed to update scheme record.')
    appErr.code = 'SCHEME_PERSISTENCE_ERROR'
    appErr.statusCode = 500
    throw appErr
  }
}

/**
 * Find a scheme by its application-level schemeId (UUID).
 * Returns null if not found.
 *
 * @param {string} schemeId
 * @returns {Promise<object|null>}
 */
export async function findById(schemeId) {
  const col = getCollection()
  try {
    if (col) {
      return col.findOne({ schemeId }, { projection: { _id: 0 } })
    }
    return _memStore.get(schemeId) ?? null
  } catch (err) {
    logger.error('Scheme findById failed', { schemeId, error: err.message })
    return null
  }
}

/**
 * Find a scheme by its schemeCode (e.g. 'PM-KISAN', 'PMFBY').
 * Returns null if not found.
 *
 * @param {string} schemeCode
 * @returns {Promise<object|null>}
 */
export async function findByCode(schemeCode) {
  const col = getCollection()
  const normalised = schemeCode.trim().toUpperCase()
  try {
    if (col) {
      return col.findOne(
        { schemeCode: { $regex: new RegExp(`^${escapeRegex(normalised)}$`, 'i') } },
        { projection: { _id: 0 } }
      )
    }
    for (const scheme of _memStore.values()) {
      if (scheme.schemeCode.toUpperCase() === normalised) return scheme
    }
    return null
  } catch (err) {
    logger.error('Scheme findByCode failed', { schemeCode, error: err.message })
    return null
  }
}

// ── Query operations ──────────────────────────────────────────────────────────

/**
 * Find all ACTIVE schemes.
 *
 * @param {number} [limit=20]
 * @returns {Promise<object[]>}
 */
export async function findActive(limit = 20) {
  const col = getCollection()
  try {
    if (col) {
      return col
        .find({ status: 'ACTIVE' }, { projection: { _id: 0 } })
        .sort({ name: 1 })
        .limit(limit)
        .toArray()
    }
    return Array.from(_memStore.values())
      .filter((s) => s.status === 'ACTIVE')
      .slice(0, limit)
  } catch (err) {
    logger.error('Scheme findActive failed', { error: err.message })
    return []
  }
}

/**
 * Find ACTIVE schemes matching one or more categories.
 *
 * @param {string[]} categories - Array of category strings to match (OR logic)
 * @param {number} [limit=20]
 * @returns {Promise<object[]>}
 */
export async function findByCategory(categories, limit = 20) {
  if (!categories || categories.length === 0) return findActive(limit)
  const normalised = categories.map((c) => c.toLowerCase())
  const col = getCollection()
  try {
    if (col) {
      return col
        .find(
          { status: 'ACTIVE', categories: { $in: normalised } },
          { projection: { _id: 0 } }
        )
        .sort({ name: 1 })
        .limit(limit)
        .toArray()
    }
    return Array.from(_memStore.values())
      .filter(
        (s) =>
          s.status === 'ACTIVE' &&
          s.categories.some((c) => normalised.includes(c))
      )
      .slice(0, limit)
  } catch (err) {
    logger.error('Scheme findByCategory failed', { categories, error: err.message })
    return []
  }
}

/**
 * Find ACTIVE schemes applicable to a specific state.
 * Returns schemes where applicableStates is empty (nationwide) OR contains
 * the given state.
 *
 * @param {string} state
 * @param {number} [limit=20]
 * @returns {Promise<object[]>}
 */
export async function findByState(state, limit = 20) {
  const normalisedState = state.trim()
  const col = getCollection()
  try {
    if (col) {
      return col
        .find(
          {
            status: 'ACTIVE',
            $or: [
              { applicableStates: { $size: 0 } },
              { applicableStates: { $elemMatch: { $regex: new RegExp(escapeRegex(normalisedState), 'i') } } },
            ],
          },
          { projection: { _id: 0 } }
        )
        .sort({ name: 1 })
        .limit(limit)
        .toArray()
    }
    return Array.from(_memStore.values())
      .filter(
        (s) =>
          s.status === 'ACTIVE' &&
          (s.applicableStates.length === 0 ||
            s.applicableStates.some(
              (st) => st.toLowerCase() === normalisedState.toLowerCase()
            ))
      )
      .slice(0, limit)
  } catch (err) {
    logger.error('Scheme findByState failed', { state, error: err.message })
    return []
  }
}

/**
 * Find candidate schemes for a farmer context.
 * Filters by: ACTIVE status, state applicability (if state known).
 * Does NOT apply eligibility rule evaluation — that belongs to the service.
 *
 * @param {object} farmerContext - Normalized farmer context
 * @param {string[]} [categories=[]] - Optional category hints
 * @param {number} [limit=10]
 * @returns {Promise<object[]>}
 */
export async function findCandidatesForFarmer(farmerContext, categories = [], limit = 10) {
  const state = farmerContext?.location?.state
  const col = getCollection()

  const normalisedCategories = categories.map((c) => c.toLowerCase())

  try {
    if (col) {
      const stateFilter = state
        ? {
            $or: [
              { applicableStates: { $size: 0 } },
              { applicableStates: { $elemMatch: { $regex: new RegExp(escapeRegex(state), 'i') } } },
            ],
          }
        : {}

      const categoryFilter =
        normalisedCategories.length > 0
          ? { categories: { $in: normalisedCategories } }
          : {}

      return col
        .find(
          { status: 'ACTIVE', ...stateFilter, ...categoryFilter },
          { projection: { _id: 0 } }
        )
        .sort({ name: 1 })
        .limit(limit)
        .toArray()
    }

    // In-memory fallback
    return Array.from(_memStore.values())
      .filter((s) => {
        if (s.status !== 'ACTIVE') return false
        if (
          state &&
          s.applicableStates.length > 0 &&
          !s.applicableStates.some((st) => st.toLowerCase() === state.toLowerCase())
        ) {
          return false
        }
        if (
          normalisedCategories.length > 0 &&
          !s.categories.some((c) => normalisedCategories.includes(c))
        ) {
          return false
        }
        return true
      })
      .slice(0, limit)
  } catch (err) {
    logger.error('Scheme findCandidatesForFarmer failed', { error: err.message })
    return []
  }
}

/**
 * General scheme search by name or tags.
 * Case-insensitive partial match on name field.
 *
 * @param {string} query - Search query text
 * @param {number} [limit=10]
 * @returns {Promise<object[]>}
 */
export async function search(query, limit = 10) {
  if (!query || !query.trim()) return findActive(limit)
  const col = getCollection()
  const pattern = new RegExp(escapeRegex(query.trim()), 'i')
  try {
    if (col) {
      return col
        .find(
          {
            $or: [
              { name: { $regex: pattern } },
              { shortName: { $regex: pattern } },
              { tags: { $elemMatch: { $regex: pattern } } },
              { schemeCode: { $regex: pattern } },
            ],
          },
          { projection: { _id: 0 } }
        )
        .sort({ name: 1 })
        .limit(limit)
        .toArray()
    }
    return Array.from(_memStore.values())
      .filter(
        (s) =>
          pattern.test(s.name) ||
          pattern.test(s.shortName) ||
          pattern.test(s.schemeCode) ||
          s.tags.some((t) => pattern.test(t))
      )
      .slice(0, limit)
  } catch (err) {
    logger.error('Scheme search failed', { query, error: err.message })
    return []
  }
}

/**
 * Count all active schemes.
 * Used for health reporting.
 *
 * @returns {Promise<number>}
 */
export async function countActiveSchemes() {
  const col = getCollection()
  try {
    if (col) {
      return col.countDocuments({ status: 'ACTIVE' })
    }
    return Array.from(_memStore.values()).filter((s) => s.status === 'ACTIVE').length
  } catch {
    return 0
  }
}

// ── Test helper ───────────────────────────────────────────────────────────────

/**
 * Clear the in-memory store. For tests only.
 */
export function _clearMemStore() {
  _memStore.clear()
}

// ── Utility ───────────────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
