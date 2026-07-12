/**
 * CropProfile schema and factory — Phase 13.
 *
 * CropProfile stores verified agronomic suitability data for a crop.
 * This is NOT FarmerProfile — it describes a crop, not a farmer.
 *
 * Key design rules:
 *   - Data comes from verified curated sources, NOT from LLM knowledge.
 *   - All numerical ranges (temperature, rainfall, water) are from agronomic literature.
 *   - Fields marked as null mean "not reliably verified" — not "zero" or "not required".
 *   - officialSources must always be populated for scoring credibility.
 *   - lastVerifiedAt tracks when the data was last checked against the source.
 *
 * Water requirement categories (used in scoring):
 *   HIGH     — > 800 mm equivalent or requires sustained irrigation
 *   MEDIUM   — 400–800 mm or supplemental irrigation
 *   LOW      — < 400 mm or largely rainfed in typical season
 *   VERY_LOW — < 200 mm, drought-tolerant crops
 *
 * Soil compatibility levels (used in scoring):
 *   PREFERRED  — crop thrives in this soil
 *   SUITABLE   — crop grows well
 *   MARGINAL   — crop can grow but with management effort
 *   UNSUITABLE — verified incompatibility
 */

/** Water requirement categories. */
export const WATER_REQ = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  VERY_LOW: 'VERY_LOW',
}

/** Soil compatibility levels. */
export const SOIL_COMPAT = {
  PREFERRED: 'PREFERRED',
  SUITABLE: 'SUITABLE',
  MARGINAL: 'MARGINAL',
  UNSUITABLE: 'UNSUITABLE',
}

/** Growing seasons. */
export const SEASON = {
  KHARIF: 'Kharif',
  RABI: 'Rabi',
  ZAID: 'Zaid',
  PERENNIAL: 'Perennial',
}

/** Crop profile status. */
export const CROP_PROFILE_STATUS = {
  ACTIVE: 'ACTIVE',
  DEPRECATED: 'DEPRECATED',
  DRAFT: 'DRAFT',
}

/**
 * Create a CropProfile record.
 * All agronomic data must come from verified sources.
 *
 * @param {object} data - Raw crop data
 * @returns {object} Normalized CropProfile
 */
export function createCropProfile(data) {
  return {
    cropCode: data.cropCode,
    name: data.name,
    localNames: Array.isArray(data.localNames) ? data.localNames : [],
    aliases: Array.isArray(data.aliases) ? data.aliases : [],

    cropType: data.cropType ?? 'cereal', // cereal, pulse, oilseed, vegetable, cash, fiber
    seasons: Array.isArray(data.seasons) ? data.seasons : [],

    // Location applicability (state-level; null = pan-India)
    suitableStates: Array.isArray(data.suitableStates) ? data.suitableStates : null,

    // Soil compatibility — map of soilType → SOIL_COMPAT level
    // Keys use normalized lowercase (e.g. 'loamy', 'sandy', 'clay', 'black', 'red')
    soilCompatibility: data.soilCompatibility ?? {},

    // Temperature range (°C) — from verified agronomic data
    temperatureRangeC: {
      min: data.temperatureRangeC?.min ?? null,
      optimalMin: data.temperatureRangeC?.optimalMin ?? null,
      optimalMax: data.temperatureRangeC?.optimalMax ?? null,
      max: data.temperatureRangeC?.max ?? null,
    },

    // Rainfall equivalent (mm) — full season requirement
    rainfallRangeMm: {
      min: data.rainfallRangeMm?.min ?? null,
      max: data.rainfallRangeMm?.max ?? null,
    },

    // Water requirement category — used in scoring
    waterRequirementCategory: data.waterRequirementCategory ?? WATER_REQ.MEDIUM,

    // Whether canal/tube-well/drip irrigation is commonly used
    irrigationRequired: data.irrigationRequired ?? false,

    // Sowing windows per season: { season: { fromMonth, toMonth } }
    sowingWindows: data.sowingWindows ?? {},

    // Crop duration in days
    durationDays: {
      min: data.durationDays?.min ?? null,
      max: data.durationDays?.max ?? null,
    },

    // Rotation: crops that work well before this crop
    rotationCompatibility: {
      goodAfter: Array.isArray(data.rotationCompatibility?.goodAfter)
        ? data.rotationCompatibility.goodAfter
        : [],
      poorAfter: Array.isArray(data.rotationCompatibility?.poorAfter)
        ? data.rotationCompatibility.poorAfter
        : [],
    },

    // Known risk factors (strings from verified agronomic documents)
    riskFactors: Array.isArray(data.riskFactors) ? data.riskFactors : [],

    // Common weather-related risks
    commonWeatherRisks: Array.isArray(data.commonWeatherRisks) ? data.commonWeatherRisks : [],

    // Commodity name for market lookups (matches commodityNormalizer keys)
    marketCommodityName: data.marketCommodityName ?? null,

    // Official agronomic sources used to populate this profile
    officialSources: Array.isArray(data.officialSources) ? data.officialSources : [],

    // Date this profile was last verified against the sources
    lastVerifiedAt: data.lastVerifiedAt ?? null,

    // Profile status
    status: data.status ?? CROP_PROFILE_STATUS.ACTIVE,

    isDemo: data.isDemo === true,
    createdAt: data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  }
}

/**
 * Normalize a soil type string to a lowercase key
 * matching the soilCompatibility map keys.
 *
 * @param {string|null} soilType
 * @returns {string|null}
 */
export function normalizeSoilTypeKey(soilType) {
  if (!soilType || typeof soilType !== 'string') return null
  const s = soilType.toLowerCase().trim()
  if (s.includes('loam')) return 'loamy'
  if (s.includes('sandy loam')) return 'sandy_loam'
  if (s.includes('sandy')) return 'sandy'
  if (s.includes('clay') && s.includes('loam')) return 'clay_loam'
  if (s.includes('clay')) return 'clay'
  if (s.includes('black') || s.includes('vertisol')) return 'black'
  if (s.includes('red')) return 'red'
  if (s.includes('alluvial')) return 'alluvial'
  if (s.includes('saline')) return 'saline'
  if (s.includes('silt')) return 'silty'
  return s.replace(/\s+/g, '_')
}
