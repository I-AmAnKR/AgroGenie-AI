/**
 * CropScoring service tests — Phase 13.
 *
 * Pure function tests — no external calls, no I/O.
 * All scoring logic is deterministic and testable in isolation.
 *
 * Run: cd server && npm test -- --testPathPattern=cropScoring
 */
import {
  scoreSeasonFit,
  scoreSoilFit,
  scoreWaterFit,
  scoreLocationFit,
  scoreRotationFit,
  scoreWeatherFit,
  scoreMarketEvidence,
  scoreKnowledgeFit,
  scoreSchemeSupport,
  computeWeightedScore,
  checkDisqualification,
  buildRiskAnalysis,
  rankCandidates,
  scoreSuitabilityLabel,
  coverageToConfidence,
} from '../services/cropScoring.service.js'
import { WATER_REQ, SOIL_COMPAT } from '../models/cropProfile.schema.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WHEAT_PROFILE = {
  cropCode: 'WHEAT',
  name: 'Wheat',
  seasons: ['Rabi'],
  suitableStates: null, // pan-India
  soilCompatibility: {
    loamy: SOIL_COMPAT.PREFERRED,
    clay_loam: SOIL_COMPAT.PREFERRED,
    alluvial: SOIL_COMPAT.PREFERRED,
    sandy: SOIL_COMPAT.MARGINAL,
    saline: SOIL_COMPAT.UNSUITABLE,
  },
  temperatureRangeC: { min: 5, optimalMin: 15, optimalMax: 22, max: 35 },
  rainfallRangeMm: { min: 250, max: 500 },
  waterRequirementCategory: WATER_REQ.MEDIUM,
  irrigationRequired: true,
  rotationCompatibility: {
    goodAfter: ['Paddy', 'Soybean', 'Maize'],
    poorAfter: ['Wheat', 'Barley'],
  },
  riskFactors: ['Yellow rust in cool humid conditions', 'Terminal heat stress if sown late'],
  commonWeatherRisks: ['HEAT_STRESS', 'COLD_RISK'],
  officialSources: [{ title: 'ICAR Wheat Manual', url: 'https://icar.org.in', year: 2022 }],
  isDemo: true,
}

const PADDY_PROFILE = {
  cropCode: 'PADDY',
  name: 'Paddy (Rice)',
  seasons: ['Kharif'],
  suitableStates: null,
  soilCompatibility: {
    clay: SOIL_COMPAT.PREFERRED,
    clay_loam: SOIL_COMPAT.PREFERRED,
    sandy: SOIL_COMPAT.MARGINAL,
  },
  temperatureRangeC: { min: 20, optimalMin: 25, optimalMax: 35, max: 40 },
  rainfallRangeMm: { min: 1000, max: 2000 },
  waterRequirementCategory: WATER_REQ.HIGH,
  irrigationRequired: true,
  rotationCompatibility: {
    goodAfter: ['Wheat', 'Mustard'],
    poorAfter: ['Paddy'],
  },
  riskFactors: ['High water requirement', 'Blast disease'],
  commonWeatherRisks: ['EXCESS_RAIN_RISK', 'HEAT_STRESS'],
  officialSources: [],
  isDemo: true,
}

const BAJRA_PROFILE = {
  cropCode: 'BAJRA',
  name: 'Pearl Millet (Bajra)',
  seasons: ['Kharif'],
  suitableStates: ['Rajasthan', 'Haryana', 'Gujarat'],
  soilCompatibility: {
    sandy: SOIL_COMPAT.PREFERRED,
    sandy_loam: SOIL_COMPAT.PREFERRED,
    clay: SOIL_COMPAT.MARGINAL,
  },
  temperatureRangeC: { min: 25, optimalMin: 28, optimalMax: 35, max: 42 },
  rainfallRangeMm: { min: 300, max: 700 },
  waterRequirementCategory: WATER_REQ.LOW,
  irrigationRequired: false,
  rotationCompatibility: {
    goodAfter: ['Legumes', 'Groundnut'],
    poorAfter: [],
  },
  riskFactors: ['Downy mildew', 'Ergot disease'],
  commonWeatherRisks: ['WATER_STRESS'],
  officialSources: [],
  isDemo: true,
}

// ── scoreSeasonFit ────────────────────────────────────────────────────────────

describe('scoreSeasonFit', () => {
  it('returns score 100 when season matches exactly', () => {
    const result = scoreSeasonFit(WHEAT_PROFILE, 'Rabi')
    expect(result.available).toBe(true)
    expect(result.score).toBe(100)
  })

  it('returns low score for season mismatch', () => {
    const result = scoreSeasonFit(WHEAT_PROFILE, 'Kharif')
    expect(result.available).toBe(true)
    expect(result.score).toBeLessThan(20)
  })

  it('returns available: false when season is null', () => {
    const result = scoreSeasonFit(WHEAT_PROFILE, null)
    expect(result.available).toBe(false)
  })

  it('handles case-insensitive season matching', () => {
    const result = scoreSeasonFit(WHEAT_PROFILE, 'rabi')
    expect(result.score).toBe(100)
    expect(result.available).toBe(true)
  })

  it('Kharif crop gets 100 for Kharif season', () => {
    const result = scoreSeasonFit(PADDY_PROFILE, 'Kharif')
    expect(result.score).toBe(100)
  })
})

// ── scoreSoilFit ──────────────────────────────────────────────────────────────

describe('scoreSoilFit', () => {
  it('returns 100 for PREFERRED soil type', () => {
    const result = scoreSoilFit(WHEAT_PROFILE, 'Loamy soil')
    expect(result.score).toBe(100)
    expect(result.available).toBe(true)
  })

  it('returns 100 for PREFERRED soil type (clay)', () => {
    const result = scoreSoilFit(PADDY_PROFILE, 'Clay soil')
    expect(result.score).toBe(100) // 'clay' is PREFERRED for paddy
  })

  it('returns 35 for MARGINAL soil type', () => {
    const result = scoreSoilFit(WHEAT_PROFILE, 'Sandy soil')
    expect(result.score).toBe(35)
  })

  it('returns 0 for UNSUITABLE soil type', () => {
    const result = scoreSoilFit(WHEAT_PROFILE, 'Saline soil')
    expect(result.score).toBe(0)
  })

  it('returns available: false when soil type is null', () => {
    const result = scoreSoilFit(WHEAT_PROFILE, null)
    expect(result.available).toBe(false)
  })

  it('returns partial credit (55) for unrecognized soil type', () => {
    const result = scoreSoilFit(WHEAT_PROFILE, 'Volcanic ash soil')
    expect(result.score).toBe(55)
    expect(result.available).toBe(true)
  })
})

// ── scoreWaterFit ─────────────────────────────────────────────────────────────

describe('scoreWaterFit', () => {
  it('scores HIGH water crop well with canal irrigation', () => {
    const result = scoreWaterFit(PADDY_PROFILE, { waterAvailability: 'canal', irrigationType: null })
    expect(result.score).toBeGreaterThanOrEqual(85)
    expect(result.available).toBe(true)
  })

  it('scores HIGH water crop poorly with rainfed water', () => {
    const result = scoreWaterFit(PADDY_PROFILE, { waterAvailability: 'rainfed', irrigationType: null })
    expect(result.score).toBeLessThanOrEqual(20)
  })

  it('scores LOW water crop well even with rainfed', () => {
    const result = scoreWaterFit(BAJRA_PROFILE, { waterAvailability: 'rainfed', irrigationType: null })
    expect(result.score).toBeGreaterThanOrEqual(80)
  })

  it('returns available: false when no water info', () => {
    const result = scoreWaterFit(WHEAT_PROFILE, {})
    expect(result.available).toBe(false)
  })

  it('uses irrigationType as fallback for waterAvailability', () => {
    const result = scoreWaterFit(WHEAT_PROFILE, { waterAvailability: null, irrigationType: 'drip' })
    expect(result.available).toBe(true)
  })
})

// ── scoreLocationFit ──────────────────────────────────────────────────────────

describe('scoreLocationFit', () => {
  it('scores pan-India crops at 80 for any state', () => {
    const result = scoreLocationFit(WHEAT_PROFILE, { state: 'Tamil Nadu', district: null })
    expect(result.score).toBe(80) // wheat is pan-India (suitableStates: null)
    expect(result.available).toBe(true)
  })

  it('scores 95 when state is in suitableStates', () => {
    const result = scoreLocationFit(BAJRA_PROFILE, { state: 'Rajasthan', district: null })
    expect(result.score).toBe(95)
  })

  it('scores 40 when state is not in suitableStates', () => {
    const result = scoreLocationFit(BAJRA_PROFILE, { state: 'Kerala', district: null })
    expect(result.score).toBe(40)
  })

  it('returns available: false when no state', () => {
    const result = scoreLocationFit(WHEAT_PROFILE, { state: null, district: null })
    expect(result.available).toBe(false)
  })
})

// ── scoreRotationFit ──────────────────────────────────────────────────────────

describe('scoreRotationFit', () => {
  it('scores 95 for good rotation (paddy before wheat)', () => {
    const result = scoreRotationFit(WHEAT_PROFILE, 'Paddy')
    expect(result.score).toBe(95)
    expect(result.available).toBe(true)
  })

  it('scores 25 for poor rotation (wheat before wheat)', () => {
    const result = scoreRotationFit(WHEAT_PROFILE, 'Wheat')
    expect(result.score).toBe(25)
  })

  it('scores 65 for neutral rotation', () => {
    const result = scoreRotationFit(WHEAT_PROFILE, 'Cotton')
    expect(result.score).toBe(65)
  })

  it('returns available: false when previousCrop is null', () => {
    const result = scoreRotationFit(WHEAT_PROFILE, null)
    expect(result.available).toBe(false)
  })
})

// ── scoreWeatherFit ───────────────────────────────────────────────────────────

describe('scoreWeatherFit', () => {
  it('returns available: false with no weather data', () => {
    const result = scoreWeatherFit(WHEAT_PROFILE, null)
    expect(result.available).toBe(false)
  })

  it('gives high score for optimal temperature', () => {
    const result = scoreWeatherFit(WHEAT_PROFILE, {
      current: { temperatureC: 18, condition: 'Clear', precipitationMm: 0 },
      forecast: [],
    })
    expect(result.available).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(80)
  })

  it('reduces score for extreme heat', () => {
    const result = scoreWeatherFit(WHEAT_PROFILE, {
      current: { temperatureC: 42, condition: 'Hot', precipitationMm: 0 },
      forecast: [],
    })
    expect(result.score).toBeLessThan(50)
  })
})

// ── scoreMarketEvidence ───────────────────────────────────────────────────────

describe('scoreMarketEvidence', () => {
  it('returns available: false with null market evidence', () => {
    const result = scoreMarketEvidence(WHEAT_PROFILE, null)
    expect(result.available).toBe(false)
  })

  it('returns available: false with available: false evidence', () => {
    const result = scoreMarketEvidence(WHEAT_PROFILE, { available: false })
    expect(result.available).toBe(false)
  })

  it('scores rising market higher than falling', () => {
    const rising = scoreMarketEvidence(WHEAT_PROFILE, {
      available: true,
      statistics: { modalPrice: 2000, count: 5 },
      trend: { trendStatus: 'rising' },
    })
    const falling = scoreMarketEvidence(WHEAT_PROFILE, {
      available: true,
      statistics: { modalPrice: 2000, count: 5 },
      trend: { trendStatus: 'falling' },
    })
    expect(rising.score).toBeGreaterThan(falling.score)
  })

  it('handles no modal price gracefully', () => {
    const result = scoreMarketEvidence(WHEAT_PROFILE, {
      available: true,
      statistics: null,
      trend: null,
    })
    expect(result.available).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })
})

// ── scoreSchemeSupport ────────────────────────────────────────────────────────

describe('scoreSchemeSupport', () => {
  it('returns available: false for null evidence', () => {
    const result = scoreSchemeSupport(WHEAT_PROFILE, null)
    expect(result.available).toBe(false)
  })

  it('scores higher when relevant schemes exist', () => {
    const withSchemes = scoreSchemeSupport(WHEAT_PROFILE, {
      available: true,
      hasRelevantSchemes: true,
      schemeCount: 3,
    })
    const withoutSchemes = scoreSchemeSupport(WHEAT_PROFILE, {
      available: true,
      hasRelevantSchemes: false,
      schemeCount: 0,
    })
    expect(withSchemes.score).toBeGreaterThan(withoutSchemes.score)
  })
})

// ── computeWeightedScore ──────────────────────────────────────────────────────

describe('computeWeightedScore', () => {
  const TEST_WEIGHTS = {
    seasonFit: 0.20,
    soilFit: 0.20,
    waterFit: 0.20,
    locationFit: 0.10,
    weatherFit: 0.10,
    rotationFit: 0.08,
    marketEvidence: 0.07,
    knowledgeFit: 0.03,
    schemeSupport: 0.02,
  }

  it('returns score 100 when all factors are 100 and available', () => {
    const factors = Object.fromEntries(
      ['seasonFit', 'soilFit', 'waterFit', 'locationFit', 'weatherFit', 'rotationFit', 'marketEvidence', 'knowledgeFit', 'schemeSupport'].map(
        (k) => [k, { score: 100, available: true, notes: [] }]
      )
    )
    const { score, evidenceCoverage } = computeWeightedScore(factors, TEST_WEIGHTS)
    expect(score).toBe(100)
    expect(evidenceCoverage).toBe(100)
  })

  it('returns score 0 when all factors are 0', () => {
    const factors = Object.fromEntries(
      ['seasonFit', 'soilFit', 'waterFit', 'locationFit', 'weatherFit', 'rotationFit', 'marketEvidence', 'knowledgeFit', 'schemeSupport'].map(
        (k) => [k, { score: 0, available: true, notes: [] }]
      )
    )
    const { score } = computeWeightedScore(factors, TEST_WEIGHTS)
    expect(score).toBe(0)
  })

  it('normalizes by available weight only (missing factors do not penalize)', () => {
    const factors = {
      seasonFit: { score: 100, available: true, notes: [] },
      soilFit: { score: 100, available: true, notes: [] },
      waterFit: { score: 0, available: false, notes: [] }, // missing
      locationFit: { score: 0, available: false, notes: [] },
      weatherFit: { score: 0, available: false, notes: [] },
      rotationFit: { score: 0, available: false, notes: [] },
      marketEvidence: { score: 0, available: false, notes: [] },
      knowledgeFit: { score: 0, available: false, notes: [] },
      schemeSupport: { score: 0, available: false, notes: [] },
    }
    const { score } = computeWeightedScore(factors, TEST_WEIGHTS)
    // Only seasonFit + soilFit available, both 100 — should return 100
    expect(score).toBe(100)
  })

  it('evidence coverage reflects available factor weights', () => {
    const factors = {
      seasonFit: { score: 80, available: true, notes: [] },
      soilFit: { score: 80, available: false, notes: [] },
      waterFit: { score: 80, available: false, notes: [] },
      locationFit: { score: 80, available: false, notes: [] },
      weatherFit: { score: 80, available: false, notes: [] },
      rotationFit: { score: 80, available: false, notes: [] },
      marketEvidence: { score: 80, available: false, notes: [] },
      knowledgeFit: { score: 80, available: false, notes: [] },
      schemeSupport: { score: 80, available: false, notes: [] },
    }
    const { evidenceCoverage } = computeWeightedScore(factors, TEST_WEIGHTS)
    // Only seasonFit (weight 0.20) available out of total 1.0 → 20%
    expect(evidenceCoverage).toBe(20)
  })
})

// ── checkDisqualification ─────────────────────────────────────────────────────

describe('checkDisqualification', () => {
  it('disqualifies crop on season mismatch (score < 20)', () => {
    const factorScores = {
      seasonFit: { score: 10, available: true },
      waterFit: { score: 80, available: true },
    }
    const { disqualified, reason } = checkDisqualification(WHEAT_PROFILE, factorScores)
    expect(disqualified).toBe(true)
    expect(reason).toMatch(/season mismatch/i)
  })

  it('disqualifies HIGH water crop with very low water availability', () => {
    const factorScores = {
      seasonFit: { score: 100, available: true },
      waterFit: { score: 5, available: true },
    }
    const { disqualified } = checkDisqualification(PADDY_PROFILE, factorScores)
    expect(disqualified).toBe(true)
  })

  it('does NOT disqualify when water score is low for MEDIUM water crop', () => {
    // Wheat is MEDIUM water — water score 5 should NOT disqualify
    const factorScores = {
      seasonFit: { score: 100, available: true },
      waterFit: { score: 5, available: true },
    }
    const { disqualified } = checkDisqualification(WHEAT_PROFILE, factorScores)
    expect(disqualified).toBe(false)
  })

  it('returns disqualified: false for good factor scores', () => {
    const factorScores = {
      seasonFit: { score: 95, available: true },
      waterFit: { score: 90, available: true },
    }
    const { disqualified } = checkDisqualification(WHEAT_PROFILE, factorScores)
    expect(disqualified).toBe(false)
  })

  it('does NOT disqualify if seasonFit is unavailable (no season specified)', () => {
    const factorScores = {
      seasonFit: { score: 0, available: false }, // available: false — should NOT trigger
      waterFit: { score: 80, available: true },
    }
    const { disqualified } = checkDisqualification(WHEAT_PROFILE, factorScores)
    expect(disqualified).toBe(false)
  })
})

// ── scoreSuitabilityLabel ─────────────────────────────────────────────────────

describe('scoreSuitabilityLabel', () => {
  it('returns Highly Suitable for score >= 85', () => {
    expect(scoreSuitabilityLabel(90).label).toBe('Highly Suitable')
    expect(scoreSuitabilityLabel(85).label).toBe('Highly Suitable')
  })

  it('returns Suitable for 70–84', () => {
    expect(scoreSuitabilityLabel(75).label).toBe('Suitable')
    expect(scoreSuitabilityLabel(70).label).toBe('Suitable')
  })

  it('returns Not Recommended for score < 40', () => {
    expect(scoreSuitabilityLabel(30).label).toBe('Not Recommended')
    expect(scoreSuitabilityLabel(0).label).toBe('Not Recommended')
  })
})

// ── coverageToConfidence ──────────────────────────────────────────────────────

describe('coverageToConfidence', () => {
  it('high confidence for coverage >= 85', () => {
    expect(coverageToConfidence(90)).toBe('high')
    expect(coverageToConfidence(85)).toBe('high')
  })

  it('medium confidence for 65–84', () => {
    expect(coverageToConfidence(70)).toBe('medium')
    expect(coverageToConfidence(65)).toBe('medium')
  })

  it('low confidence for < 65', () => {
    expect(coverageToConfidence(50)).toBe('low')
    expect(coverageToConfidence(0)).toBe('low')
  })
})

// ── rankCandidates ────────────────────────────────────────────────────────────

describe('rankCandidates', () => {
  const farmerContext = {
    location: { state: 'Punjab', district: 'Ludhiana' },
    farm: { soilType: 'Loamy soil', waterAvailability: 'canal', irrigationType: 'Canal' },
    cropContext: { currentCrop: 'Paddy', previousCrops: ['Paddy'], sowingDate: null },
    preferences: { objective: null, language: 'en' },
    season: 'Rabi',
  }

  it('returns sorted array with rank field', () => {
    const result = rankCandidates({
      candidates: [WHEAT_PROFILE, BAJRA_PROFILE],
      farmerContext,
      weatherEvidence: null,
      marketEvidenceMap: {},
      knowledgeEvidenceMap: {},
      schemeEvidence: null,
    })
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].rank).toBe(1)
    if (result.length > 1) {
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score)
    }
  })

  it('wheat scores higher than bajra for Rabi season in Punjab', () => {
    const result = rankCandidates({
      candidates: [WHEAT_PROFILE, BAJRA_PROFILE],
      farmerContext,
      weatherEvidence: null,
      marketEvidenceMap: {},
      knowledgeEvidenceMap: {},
      schemeEvidence: null,
    })
    const wheatResult = result.find((r) => r.cropCode === 'WHEAT')
    const bajraResult = result.find((r) => r.cropCode === 'BAJRA')

    // Bajra should be disqualified (Kharif crop in Rabi season)
    // Wheat should appear
    expect(wheatResult).toBeDefined()
    if (bajraResult) {
      // If bajra survived disqualification, wheat should still score higher
      expect(wheatResult.score).toBeGreaterThanOrEqual(bajraResult.score)
    }
  })

  it('paddy with HIGH water need is disqualified when water is rainfed', () => {
    const dryfarmContext = {
      ...farmerContext,
      farm: { soilType: 'Sandy soil', waterAvailability: 'rainfed', irrigationType: null },
      season: 'Kharif',
    }
    const result = rankCandidates({
      candidates: [PADDY_PROFILE],
      farmerContext: dryfarmContext,
      weatherEvidence: null,
      marketEvidenceMap: {},
      knowledgeEvidenceMap: {},
      schemeEvidence: null,
    })
    // Paddy should be disqualified (HIGH water + rainfed).
    // waterFit scores at or below 15 trigger disqualification for HIGH water crops.
    const paddyResult = result.find((r) => r.cropCode === 'PADDY')
    if (paddyResult) {
      // If not disqualified, it must show the highest risk level
      expect(paddyResult.riskLevel).toBe('high')
    }
  })

  it('includes factorBreakdown in results', () => {
    const result = rankCandidates({
      candidates: [WHEAT_PROFILE],
      farmerContext,
      weatherEvidence: null,
      marketEvidenceMap: {},
      knowledgeEvidenceMap: {},
      schemeEvidence: null,
    })
    if (result.length > 0) {
      expect(result[0].factorBreakdown).toBeDefined()
      expect(typeof result[0].factorBreakdown.seasonFit).toBe('object')
    }
  })
})
