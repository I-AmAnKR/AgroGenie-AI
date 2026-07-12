/**
 * Crop Profile Seed — Phase 13.
 *
 * 12 verified crop profiles for major Kharif and Rabi crops.
 * All agronomic data sourced from ICAR, ICRISAT, and state agriculture
 * department publications.
 *
 * All profiles are isDemo: true — curated from public agronomic guidelines,
 * not real-time recommendations.
 *
 * Data sources (abbreviated):
 *   ICAR  — Indian Council of Agricultural Research (icar.org.in)
 *   ICRISAT — International Crops Research Institute for the Semi-Arid Tropics
 *   NABARD — National Bank for Agriculture and Rural Development
 *   NHB   — National Horticulture Board
 *
 * Season: Kharif = June–October sowing; Rabi = October–March sowing
 *
 * Water requirement categories:
 *   HIGH (>800mm), MEDIUM (400-800mm), LOW (<400mm), VERY_LOW (<200mm)
 */
import { createCropProfile, WATER_REQ, SOIL_COMPAT, SEASON, CROP_PROFILE_STATUS } from '../../models/cropProfile.schema.js'

// ── In-memory crop profile store ──────────────────────────────────────────────

/**
 * All active crop profiles.
 * Used by the CropProfile repository for candidate generation and lookup.
 */
export const CROP_PROFILES = [
  // ── KHARIF CROPS ──────────────────────────────────────────────────────────

  createCropProfile({
    cropCode: 'PADDY',
    name: 'Paddy (Rice)',
    localNames: ['Dhan', 'Chawal', 'Arwa'],
    aliases: ['rice', 'paddy', 'dhan', 'chawal'],
    cropType: 'cereal',
    seasons: [SEASON.KHARIF],
    suitableStates: null, // pan-India
    soilCompatibility: {
      clay: SOIL_COMPAT.PREFERRED,
      clay_loam: SOIL_COMPAT.PREFERRED,
      loamy: SOIL_COMPAT.SUITABLE,
      silty: SOIL_COMPAT.SUITABLE,
      alluvial: SOIL_COMPAT.SUITABLE,
      sandy: SOIL_COMPAT.MARGINAL,
      black: SOIL_COMPAT.MARGINAL,
      red: SOIL_COMPAT.MARGINAL,
      sandy_loam: SOIL_COMPAT.MARGINAL,
    },
    temperatureRangeC: { min: 20, optimalMin: 25, optimalMax: 35, max: 40 },
    rainfallRangeMm: { min: 1000, max: 2000 },
    waterRequirementCategory: WATER_REQ.HIGH,
    irrigationRequired: true,
    sowingWindows: {
      Kharif: { fromMonth: 6, toMonth: 7 },
    },
    durationDays: { min: 90, max: 150 },
    rotationCompatibility: {
      goodAfter: ['Wheat', 'Mustard', 'Potato'],
      poorAfter: ['Paddy'],
    },
    riskFactors: [
      'High water requirement — unsuitable for water-scarce farms',
      'Blast disease (Pyricularia oryzae) in humid conditions',
      'Brown Plant Hopper infestation risk',
    ],
    commonWeatherRisks: ['EXCESS_RAIN_RISK', 'HEAT_STRESS'],
    marketCommodityName: 'Rice',
    officialSources: [
      { title: 'ICAR Rice Production Manual', url: 'https://icar.org.in', year: 2022 },
    ],
    lastVerifiedAt: '2024-01-15T00:00:00.000Z',
    isDemo: true,
  }),

  createCropProfile({
    cropCode: 'MAIZE',
    name: 'Maize',
    localNames: ['Makka', 'Makkai', 'Bhutta'],
    aliases: ['maize', 'corn', 'makka', 'makkai'],
    cropType: 'cereal',
    seasons: [SEASON.KHARIF, SEASON.RABI, SEASON.ZAID],
    suitableStates: null,
    soilCompatibility: {
      loamy: SOIL_COMPAT.PREFERRED,
      sandy_loam: SOIL_COMPAT.PREFERRED,
      alluvial: SOIL_COMPAT.SUITABLE,
      clay_loam: SOIL_COMPAT.SUITABLE,
      black: SOIL_COMPAT.SUITABLE,
      red: SOIL_COMPAT.SUITABLE,
      clay: SOIL_COMPAT.MARGINAL,
      sandy: SOIL_COMPAT.MARGINAL,
      saline: SOIL_COMPAT.UNSUITABLE,
    },
    temperatureRangeC: { min: 15, optimalMin: 21, optimalMax: 30, max: 38 },
    rainfallRangeMm: { min: 500, max: 900 },
    waterRequirementCategory: WATER_REQ.MEDIUM,
    irrigationRequired: false,
    sowingWindows: {
      Kharif: { fromMonth: 6, toMonth: 7 },
      Rabi: { fromMonth: 10, toMonth: 11 },
    },
    durationDays: { min: 80, max: 110 },
    rotationCompatibility: {
      goodAfter: ['Legumes', 'Wheat', 'Mustard'],
      poorAfter: ['Maize'],
    },
    riskFactors: [
      'Fall Armyworm (Spodoptera frugiperda) — a major emerging pest',
      'Waterlogging severely damages the crop',
    ],
    commonWeatherRisks: ['WATER_STRESS', 'HEAT_STRESS'],
    marketCommodityName: 'Maize',
    officialSources: [
      { title: 'ICAR Maize Production Handbook', url: 'https://icar.org.in', year: 2022 },
    ],
    lastVerifiedAt: '2024-01-15T00:00:00.000Z',
    isDemo: true,
  }),

  createCropProfile({
    cropCode: 'BAJRA',
    name: 'Pearl Millet (Bajra)',
    localNames: ['Bajra', 'Bajra', 'Kambu'],
    aliases: ['bajra', 'pearl millet', 'kambu', 'sajje'],
    cropType: 'cereal',
    seasons: [SEASON.KHARIF],
    suitableStates: ['Rajasthan', 'Haryana', 'Gujarat', 'Maharashtra', 'Uttar Pradesh', 'Madhya Pradesh'],
    soilCompatibility: {
      sandy: SOIL_COMPAT.PREFERRED,
      sandy_loam: SOIL_COMPAT.PREFERRED,
      loamy: SOIL_COMPAT.SUITABLE,
      red: SOIL_COMPAT.SUITABLE,
      black: SOIL_COMPAT.MARGINAL,
      clay: SOIL_COMPAT.MARGINAL,
      saline: SOIL_COMPAT.UNSUITABLE,
    },
    temperatureRangeC: { min: 25, optimalMin: 28, optimalMax: 35, max: 42 },
    rainfallRangeMm: { min: 300, max: 700 },
    waterRequirementCategory: WATER_REQ.LOW,
    irrigationRequired: false,
    sowingWindows: {
      Kharif: { fromMonth: 6, toMonth: 7 },
    },
    durationDays: { min: 65, max: 90 },
    rotationCompatibility: {
      goodAfter: ['Legumes', 'Groundnut'],
      poorAfter: [],
    },
    riskFactors: [
      'Downy mildew disease in humid conditions',
      'Ergot disease risk during flowering',
    ],
    commonWeatherRisks: ['WATER_STRESS'],
    marketCommodityName: 'Bajra',
    officialSources: [
      { title: 'ICAR Pearl Millet Production Guide', url: 'https://icar.org.in', year: 2021 },
    ],
    lastVerifiedAt: '2024-01-15T00:00:00.000Z',
    isDemo: true,
  }),

  createCropProfile({
    cropCode: 'SOYBEAN',
    name: 'Soybean',
    localNames: ['Soyabean', 'Bhatmas'],
    aliases: ['soybean', 'soya', 'soyabean', 'bhatmas'],
    cropType: 'oilseed',
    seasons: [SEASON.KHARIF],
    suitableStates: ['Madhya Pradesh', 'Maharashtra', 'Rajasthan', 'Karnataka', 'Andhra Pradesh'],
    soilCompatibility: {
      loamy: SOIL_COMPAT.PREFERRED,
      clay_loam: SOIL_COMPAT.PREFERRED,
      black: SOIL_COMPAT.SUITABLE,
      alluvial: SOIL_COMPAT.SUITABLE,
      red: SOIL_COMPAT.SUITABLE,
      sandy_loam: SOIL_COMPAT.MARGINAL,
      sandy: SOIL_COMPAT.UNSUITABLE,
    },
    temperatureRangeC: { min: 20, optimalMin: 25, optimalMax: 30, max: 38 },
    rainfallRangeMm: { min: 600, max: 900 },
    waterRequirementCategory: WATER_REQ.MEDIUM,
    irrigationRequired: false,
    sowingWindows: {
      Kharif: { fromMonth: 6, toMonth: 7 },
    },
    durationDays: { min: 90, max: 120 },
    rotationCompatibility: {
      goodAfter: ['Wheat', 'Jowar', 'Paddy'],
      poorAfter: ['Soybean'],
    },
    riskFactors: [
      'Yellow mosaic virus — transmitted by whitefly',
      'Girdle beetle damage during kharif',
    ],
    commonWeatherRisks: ['EXCESS_RAIN_RISK', 'WATER_STRESS'],
    marketCommodityName: 'Soybean',
    officialSources: [
      { title: 'NRCS Soybean Production Manual', url: 'https://icar.org.in', year: 2021 },
    ],
    lastVerifiedAt: '2024-01-15T00:00:00.000Z',
    isDemo: true,
  }),

  createCropProfile({
    cropCode: 'GROUNDNUT',
    name: 'Groundnut',
    localNames: ['Moongphali', 'Singdana', 'Pallelu'],
    aliases: ['groundnut', 'peanut', 'moongphali', 'singdana'],
    cropType: 'oilseed',
    seasons: [SEASON.KHARIF, SEASON.RABI, SEASON.ZAID],
    suitableStates: ['Gujarat', 'Andhra Pradesh', 'Tamil Nadu', 'Karnataka', 'Maharashtra', 'Rajasthan'],
    soilCompatibility: {
      sandy_loam: SOIL_COMPAT.PREFERRED,
      red: SOIL_COMPAT.PREFERRED,
      loamy: SOIL_COMPAT.SUITABLE,
      sandy: SOIL_COMPAT.SUITABLE,
      black: SOIL_COMPAT.MARGINAL,
      clay: SOIL_COMPAT.UNSUITABLE,
      clay_loam: SOIL_COMPAT.MARGINAL,
    },
    temperatureRangeC: { min: 20, optimalMin: 25, optimalMax: 35, max: 40 },
    rainfallRangeMm: { min: 450, max: 750 },
    waterRequirementCategory: WATER_REQ.MEDIUM,
    irrigationRequired: false,
    sowingWindows: {
      Kharif: { fromMonth: 6, toMonth: 7 },
      Rabi: { fromMonth: 10, toMonth: 11 },
    },
    durationDays: { min: 90, max: 130 },
    rotationCompatibility: {
      goodAfter: ['Cereals', 'Paddy', 'Jowar'],
      poorAfter: ['Groundnut', 'Soybean'],
    },
    riskFactors: [
      'Tikka disease (leaf spot) in humid weather',
      'Aflatoxin contamination risk if pods not dried properly',
    ],
    commonWeatherRisks: ['WATER_STRESS', 'EXCESS_RAIN_RISK'],
    marketCommodityName: 'Groundnut',
    officialSources: [
      { title: 'ICAR Groundnut Production Manual', url: 'https://icar.org.in', year: 2022 },
    ],
    lastVerifiedAt: '2024-01-15T00:00:00.000Z',
    isDemo: true,
  }),

  createCropProfile({
    cropCode: 'COTTON',
    name: 'Cotton',
    localNames: ['Kapas', 'Rui', 'Paruthi'],
    aliases: ['cotton', 'kapas', 'bt cotton'],
    cropType: 'cash',
    seasons: [SEASON.KHARIF],
    suitableStates: ['Gujarat', 'Maharashtra', 'Andhra Pradesh', 'Telangana', 'Punjab', 'Haryana', 'Rajasthan', 'Karnataka'],
    soilCompatibility: {
      black: SOIL_COMPAT.PREFERRED,
      clay_loam: SOIL_COMPAT.PREFERRED,
      alluvial: SOIL_COMPAT.SUITABLE,
      loamy: SOIL_COMPAT.SUITABLE,
      red: SOIL_COMPAT.MARGINAL,
      sandy: SOIL_COMPAT.UNSUITABLE,
    },
    temperatureRangeC: { min: 18, optimalMin: 25, optimalMax: 35, max: 43 },
    rainfallRangeMm: { min: 500, max: 1000 },
    waterRequirementCategory: WATER_REQ.MEDIUM,
    irrigationRequired: false,
    sowingWindows: {
      Kharif: { fromMonth: 5, toMonth: 6 },
    },
    durationDays: { min: 160, max: 210 },
    rotationCompatibility: {
      goodAfter: ['Wheat', 'Gram', 'Mustard'],
      poorAfter: ['Cotton'],
    },
    riskFactors: [
      'Bollworm infestation (Pink, American, Spotted)',
      'Whitefly-transmitted leaf curl virus',
      'High input cost for Bt hybrid seeds',
    ],
    commonWeatherRisks: ['WATER_STRESS', 'HEAT_STRESS'],
    marketCommodityName: 'Cotton',
    officialSources: [
      { title: 'ICAR Cotton Crop Production Guide', url: 'https://icar.org.in', year: 2022 },
    ],
    lastVerifiedAt: '2024-01-15T00:00:00.000Z',
    isDemo: true,
  }),

  // ── RABI CROPS ────────────────────────────────────────────────────────────

  createCropProfile({
    cropCode: 'WHEAT',
    name: 'Wheat',
    localNames: ['Gehu', 'Gahu', 'Godhi'],
    aliases: ['wheat', 'gehu', 'gehun', 'gahu'],
    cropType: 'cereal',
    seasons: [SEASON.RABI],
    suitableStates: null,
    soilCompatibility: {
      loamy: SOIL_COMPAT.PREFERRED,
      clay_loam: SOIL_COMPAT.PREFERRED,
      alluvial: SOIL_COMPAT.PREFERRED,
      black: SOIL_COMPAT.SUITABLE,
      clay: SOIL_COMPAT.SUITABLE,
      sandy_loam: SOIL_COMPAT.SUITABLE,
      sandy: SOIL_COMPAT.MARGINAL,
      saline: SOIL_COMPAT.UNSUITABLE,
    },
    temperatureRangeC: { min: 5, optimalMin: 15, optimalMax: 22, max: 35 },
    rainfallRangeMm: { min: 250, max: 500 },
    waterRequirementCategory: WATER_REQ.MEDIUM,
    irrigationRequired: true,
    sowingWindows: {
      Rabi: { fromMonth: 10, toMonth: 11 },
    },
    durationDays: { min: 110, max: 135 },
    rotationCompatibility: {
      goodAfter: ['Paddy', 'Soybean', 'Maize', 'Groundnut'],
      poorAfter: ['Wheat', 'Barley'],
    },
    riskFactors: [
      'Yellow rust (stripe rust) in cool humid conditions',
      'Terminal heat stress if sown late (after November 25)',
      'Loose smut disease risk',
    ],
    commonWeatherRisks: ['HEAT_STRESS', 'COLD_RISK'],
    marketCommodityName: 'Wheat',
    officialSources: [
      { title: 'ICAR Wheat Production Manual', url: 'https://icar.org.in', year: 2022 },
    ],
    lastVerifiedAt: '2024-01-15T00:00:00.000Z',
    isDemo: true,
  }),

  createCropProfile({
    cropCode: 'MUSTARD',
    name: 'Mustard',
    localNames: ['Sarson', 'Rai', 'Avalu'],
    aliases: ['mustard', 'sarson', 'rai', 'rapeseed'],
    cropType: 'oilseed',
    seasons: [SEASON.RABI],
    suitableStates: ['Rajasthan', 'Uttar Pradesh', 'Haryana', 'Madhya Pradesh', 'West Bengal', 'Punjab'],
    soilCompatibility: {
      loamy: SOIL_COMPAT.PREFERRED,
      sandy_loam: SOIL_COMPAT.PREFERRED,
      alluvial: SOIL_COMPAT.SUITABLE,
      clay_loam: SOIL_COMPAT.SUITABLE,
      red: SOIL_COMPAT.MARGINAL,
      clay: SOIL_COMPAT.MARGINAL,
      sandy: SOIL_COMPAT.MARGINAL,
    },
    temperatureRangeC: { min: 5, optimalMin: 10, optimalMax: 20, max: 32 },
    rainfallRangeMm: { min: 200, max: 450 },
    waterRequirementCategory: WATER_REQ.LOW,
    irrigationRequired: false,
    sowingWindows: {
      Rabi: { fromMonth: 9, toMonth: 10 },
    },
    durationDays: { min: 90, max: 120 },
    rotationCompatibility: {
      goodAfter: ['Paddy', 'Maize', 'Bajra'],
      poorAfter: ['Sunflower', 'Mustard'],
    },
    riskFactors: [
      'Alternaria blight in warm humid conditions',
      'Aphid infestation risk during flowering',
    ],
    commonWeatherRisks: ['HEAT_STRESS', 'WATER_STRESS'],
    marketCommodityName: 'Mustard',
    officialSources: [
      { title: 'ICAR Mustard Production Guide', url: 'https://icar.org.in', year: 2021 },
    ],
    lastVerifiedAt: '2024-01-15T00:00:00.000Z',
    isDemo: true,
  }),

  createCropProfile({
    cropCode: 'GRAM',
    name: 'Chickpea (Gram)',
    localNames: ['Chana', 'Gram', 'Kala Chana'],
    aliases: ['chickpea', 'gram', 'chana', 'bengal gram', 'chick pea'],
    cropType: 'pulse',
    seasons: [SEASON.RABI],
    suitableStates: ['Madhya Pradesh', 'Rajasthan', 'Uttar Pradesh', 'Maharashtra', 'Karnataka', 'Andhra Pradesh', 'Haryana', 'Punjab'],
    soilCompatibility: {
      loamy: SOIL_COMPAT.PREFERRED,
      sandy_loam: SOIL_COMPAT.PREFERRED,
      black: SOIL_COMPAT.SUITABLE,
      alluvial: SOIL_COMPAT.SUITABLE,
      red: SOIL_COMPAT.SUITABLE,
      clay: SOIL_COMPAT.MARGINAL,
      saline: SOIL_COMPAT.UNSUITABLE,
    },
    temperatureRangeC: { min: 5, optimalMin: 15, optimalMax: 25, max: 35 },
    rainfallRangeMm: { min: 200, max: 450 },
    waterRequirementCategory: WATER_REQ.LOW,
    irrigationRequired: false,
    sowingWindows: {
      Rabi: { fromMonth: 10, toMonth: 11 },
    },
    durationDays: { min: 90, max: 120 },
    rotationCompatibility: {
      goodAfter: ['Cereals', 'Wheat', 'Paddy', 'Jowar'],
      poorAfter: ['Chickpea', 'Lentil'],
    },
    riskFactors: [
      'Pod borer (Helicoverpa armigera) — most serious pest',
      'Wilt and root rot diseases in waterlogged soils',
    ],
    commonWeatherRisks: ['EXCESS_RAIN_RISK', 'COLD_RISK'],
    marketCommodityName: 'Gram',
    officialSources: [
      { title: 'ICRISAT Chickpea Production Guide', url: 'https://icrisat.org', year: 2021 },
    ],
    lastVerifiedAt: '2024-01-15T00:00:00.000Z',
    isDemo: true,
  }),

  createCropProfile({
    cropCode: 'LENTIL',
    name: 'Lentil (Masoor)',
    localNames: ['Masoor', 'Masur Dal'],
    aliases: ['lentil', 'masoor', 'masur', 'red lentil'],
    cropType: 'pulse',
    seasons: [SEASON.RABI],
    suitableStates: ['Uttar Pradesh', 'Madhya Pradesh', 'Bihar', 'West Bengal', 'Rajasthan'],
    soilCompatibility: {
      loamy: SOIL_COMPAT.PREFERRED,
      clay_loam: SOIL_COMPAT.SUITABLE,
      alluvial: SOIL_COMPAT.SUITABLE,
      sandy_loam: SOIL_COMPAT.SUITABLE,
      black: SOIL_COMPAT.MARGINAL,
      sandy: SOIL_COMPAT.MARGINAL,
    },
    temperatureRangeC: { min: 5, optimalMin: 15, optimalMax: 22, max: 30 },
    rainfallRangeMm: { min: 200, max: 400 },
    waterRequirementCategory: WATER_REQ.LOW,
    irrigationRequired: false,
    sowingWindows: {
      Rabi: { fromMonth: 10, toMonth: 11 },
    },
    durationDays: { min: 95, max: 115 },
    rotationCompatibility: {
      goodAfter: ['Paddy', 'Maize', 'Jute'],
      poorAfter: ['Lentil', 'Chickpea'],
    },
    riskFactors: [
      'Rust disease in humid conditions',
      'Aphid and pod borer damage',
    ],
    commonWeatherRisks: ['COLD_RISK', 'EXCESS_RAIN_RISK'],
    marketCommodityName: 'Masoor',
    officialSources: [
      { title: 'ICAR Lentil Production Guide', url: 'https://icar.org.in', year: 2020 },
    ],
    lastVerifiedAt: '2024-01-15T00:00:00.000Z',
    isDemo: true,
  }),

  createCropProfile({
    cropCode: 'POTATO',
    name: 'Potato',
    localNames: ['Aloo', 'Batata'],
    aliases: ['potato', 'aloo', 'batata'],
    cropType: 'vegetable',
    seasons: [SEASON.RABI, SEASON.ZAID],
    suitableStates: ['Uttar Pradesh', 'West Bengal', 'Bihar', 'Punjab', 'Madhya Pradesh', 'Himachal Pradesh'],
    soilCompatibility: {
      sandy_loam: SOIL_COMPAT.PREFERRED,
      loamy: SOIL_COMPAT.PREFERRED,
      alluvial: SOIL_COMPAT.SUITABLE,
      clay_loam: SOIL_COMPAT.MARGINAL,
      clay: SOIL_COMPAT.UNSUITABLE,
      black: SOIL_COMPAT.MARGINAL,
    },
    temperatureRangeC: { min: 5, optimalMin: 15, optimalMax: 25, max: 32 },
    rainfallRangeMm: { min: 400, max: 700 },
    waterRequirementCategory: WATER_REQ.MEDIUM,
    irrigationRequired: true,
    sowingWindows: {
      Rabi: { fromMonth: 9, toMonth: 11 },
    },
    durationDays: { min: 60, max: 110 },
    rotationCompatibility: {
      goodAfter: ['Wheat', 'Paddy', 'Maize'],
      poorAfter: ['Tomato', 'Brinjal', 'Pepper'],
    },
    riskFactors: [
      'Late blight (Phytophthora infestans) — can cause crop failure',
      'Requires certified disease-free seed tubers',
      'High market price volatility',
    ],
    commonWeatherRisks: ['EXCESS_RAIN_RISK', 'COLD_RISK'],
    marketCommodityName: 'Potato',
    officialSources: [
      { title: 'CPRI Potato Production Technology', url: 'https://icar.org.in', year: 2021 },
    ],
    lastVerifiedAt: '2024-01-15T00:00:00.000Z',
    isDemo: true,
  }),

  createCropProfile({
    cropCode: 'JOWAR',
    name: 'Sorghum (Jowar)',
    localNames: ['Jowar', 'Jonnalu', 'Jola'],
    aliases: ['jowar', 'sorghum', 'jonnalu', 'jola'],
    cropType: 'cereal',
    seasons: [SEASON.KHARIF, SEASON.RABI],
    suitableStates: ['Maharashtra', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Madhya Pradesh', 'Rajasthan', 'Gujarat'],
    soilCompatibility: {
      black: SOIL_COMPAT.PREFERRED,
      clay_loam: SOIL_COMPAT.PREFERRED,
      loamy: SOIL_COMPAT.SUITABLE,
      red: SOIL_COMPAT.SUITABLE,
      sandy_loam: SOIL_COMPAT.SUITABLE,
      sandy: SOIL_COMPAT.MARGINAL,
      clay: SOIL_COMPAT.MARGINAL,
    },
    temperatureRangeC: { min: 18, optimalMin: 25, optimalMax: 35, max: 42 },
    rainfallRangeMm: { min: 350, max: 700 },
    waterRequirementCategory: WATER_REQ.LOW,
    irrigationRequired: false,
    sowingWindows: {
      Kharif: { fromMonth: 6, toMonth: 7 },
      Rabi: { fromMonth: 10, toMonth: 11 },
    },
    durationDays: { min: 90, max: 130 },
    rotationCompatibility: {
      goodAfter: ['Legumes', 'Gram', 'Groundnut'],
      poorAfter: ['Jowar'],
    },
    riskFactors: [
      'Charcoal rot in dry conditions',
      'Shoot fly damage at seedling stage',
    ],
    commonWeatherRisks: ['WATER_STRESS', 'HEAT_STRESS'],
    marketCommodityName: 'Jowar',
    officialSources: [
      { title: 'ICRISAT Sorghum Production Manual', url: 'https://icrisat.org', year: 2021 },
    ],
    lastVerifiedAt: '2024-01-15T00:00:00.000Z',
    isDemo: true,
  }),
]

/**
 * Find all active crop profiles.
 *
 * @returns {object[]}
 */
export function getAllCropProfiles() {
  return CROP_PROFILES.filter((p) => p.status === 'ACTIVE')
}

/**
 * Find a crop profile by its cropCode.
 *
 * @param {string} code
 * @returns {object|null}
 */
export function findProfileByCode(code) {
  return CROP_PROFILES.find((p) => p.cropCode === code) ?? null
}

/**
 * Find crop profiles by season.
 *
 * @param {string} season - 'Kharif' | 'Rabi' | 'Zaid' | 'Perennial'
 * @returns {object[]}
 */
export function findProfilesBySeason(season) {
  if (!season) return getAllCropProfiles()
  const norm = season.trim()
  return getAllCropProfiles().filter((p) => p.seasons.some((s) => s.toLowerCase() === norm.toLowerCase()))
}

/**
 * Resolve a crop name (including aliases) to a CropProfile.
 *
 * @param {string} name
 * @returns {object|null}
 */
export function findProfileByName(name) {
  if (!name) return null
  const norm = name.toLowerCase().trim()
  return (
    CROP_PROFILES.find(
      (p) =>
        p.name.toLowerCase() === norm ||
        p.aliases.some((a) => a.toLowerCase() === norm) ||
        p.localNames.some((l) => l.toLowerCase() === norm) ||
        p.cropCode.toLowerCase() === norm
    ) ?? null
  )
}
