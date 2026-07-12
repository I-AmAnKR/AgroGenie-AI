/**
 * Context Middleware — Phase 9.
 *
 * Loads and normalizes FarmerProfile context for injection into agent calls.
 *
 * Architecture:
 *   - Attaches normalized farmerContext to res.locals.farmerContext.
 *   - Does NOT load the full MongoDB document into every request.
 *   - Normalizes raw profile fields into a structured context object.
 *   - For current development mode, uses demo-user strategy from Phase 5.
 *   - Future: userId will come from authentication middleware.
 *
 * Context shape:
 * {
 *   location: { state, district },
 *   farm: { area, areaUnit, soilType, irrigationType, waterAvailability },
 *   cropContext: { currentCrop, previousCrops, sowingDate },
 *   preferences: { objective, language }
 * }
 *
 * Security:
 *   - Does NOT expose full MongoDB document to providers.
 *   - Does NOT load sensitive personal information (phone, Aadhaar, etc.).
 *   - Context is serializable — no circular references or prototype chains.
 */
import { getProfile } from '../services/profile.service.js'
import { buildAgentContext } from '../services/context.builder.js'
import logger from '../utils/logger.js'

/**
 * Normalize a raw FarmerProfile (from MongoDB or mock store) into a safe,
 * minimal context object for agent injection.
 *
 * @param {object} rawProfile - Raw profile record
 * @returns {object} Normalized farmer context
 */
export function normalizeFarmerContext(rawProfile) {
  if (!rawProfile || typeof rawProfile !== 'object') {
    return {
      location: { state: null, district: null },
      farm: {
        area: null,
        areaUnit: null,
        soilType: null,
        irrigationType: null,
        waterAvailability: null,
      },
      cropContext: { currentCrop: null, previousCrops: [], sowingDate: null },
      preferences: { objective: null, language: 'en' },
    }
  }

  return {
    location: {
      state: rawProfile.state ?? null,
      district: rawProfile.district ?? null,
    },
    farm: {
      area: rawProfile.farmArea ?? null,
      areaUnit: rawProfile.farmAreaUnit ?? null,
      soilType: rawProfile.soilType ?? null,
      irrigationType: rawProfile.irrigationType ?? null,
      // waterAvailability is not a dedicated field in Phase 5 profile —
      // derive from irrigationType presence as a hint
      waterAvailability: rawProfile.irrigationType ? 'available' : null,
    },
    cropContext: {
      currentCrop: rawProfile.currentCrop ?? null,
      previousCrops: Array.isArray(rawProfile.previousCrops) ? rawProfile.previousCrops : [],
      sowingDate: rawProfile.sowingDate ?? null,
    },
    preferences: {
      objective: rawProfile.farmingObjective ?? null,
      language: rawProfile.preferredLanguage ?? 'en',
    },
  }
}

/**
 * Context middleware — attaches normalized FarmerProfile context to res.locals.
 *
 * If profile loading fails, attaches an empty context and continues.
 * This ensures agent calls can still proceed without a complete profile.
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {Function} next - Express next function
 */
export async function contextMiddleware(req, res, next) {
  // Use userId from request body or query; default to demo-user for current dev mode
  // Future: this will come from req.user.id set by authentication middleware
  const userId =
    req.body?.userId ??
    req.query?.userId ??
    res.locals?.userId ??
    'demo-user'

  try {
    const rawProfile = await getProfile(userId)
    res.locals.farmerContext = normalizeFarmerContext(rawProfile)
    // Build agent context from memory
    const memoryContext = await buildAgentContext(userId, req.body?.intent ?? 'GENERAL')
    res.locals.memoryContext = memoryContext
    res.locals.userId = userId
  } catch (err) {
    logger.warn('contextMiddleware: profile load failed — using empty context', {
      requestId: res.locals.requestId,
      userId,
      code: err.code ?? 'UNKNOWN',
    })
    res.locals.farmerContext = normalizeFarmerContext(null)
    res.locals.memoryContext = '--- FARMER CONTEXT & MEMORY ---\nRelevant Historical Memory: None\n-------------------------------\n'
    res.locals.userId = userId
  }

  next()
}
