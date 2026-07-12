/**
 * Crop Agent schema — Phase 13.
 *
 * Documents the agent contract for the Crop Recommendation Agent.
 * Updated from Phase 9 placeholder to reflect Phase 13 live implementation.
 */

/**
 * Agent schema contract for the Crop Recommendation Agent.
 * Documents what fields are produced in the agent result.
 */
export const CROP_AGENT_SCHEMA = {
  intent: 'CROP_RECOMMENDATION',
  agentsUsed: ['CropAgent', 'CropScoringService', 'WeatherProvider', 'MarketProvider', 'SchemeService', 'RAG'],
  statuses: ['success', 'partial_success', 'needs_clarification', 'failed'],

  /**
   * recommendation field structure attached to agent result (Phase 13).
   * Passed through chat.service.js as result.recommendation for frontend rendering.
   */
  recommendationShape: {
    season: 'string',
    scoringVersion: 'string',
    candidatesEvaluated: 'number',
    topCrops: [
      {
        rank: 'number',
        cropCode: 'string',
        name: 'string',
        score: 'number (0-100)',
        suitabilityLabel: 'string',
        suitabilityColor: 'string (success|info|warning|danger)',
        evidenceCoverage: 'number (0-100)',
        confidence: 'string (high|medium|low)',
        waterRequirementCategory: 'string (HIGH|MEDIUM|LOW|VERY_LOW)',
        durationDays: '{ min: number, max: number }',
        riskLevel: 'string (high|medium|low)',
        keyRisks: 'string[]',
        factorBreakdown: 'object (one entry per scoring factor)',
      },
    ],
    evidenceSummary: {
      weatherAvailable: 'boolean',
      marketAvailable: 'boolean',
      knowledgeAvailable: 'boolean',
      schemeAvailable: 'boolean',
    },
    isDemo: 'boolean',
  },
}

/**
 * Scoring factors produced by the CropScoringService.
 */
export const SCORING_FACTORS = [
  'seasonFit',
  'soilFit',
  'waterFit',
  'locationFit',
  'weatherFit',
  'rotationFit',
  'marketEvidence',
  'knowledgeFit',
  'schemeSupport',
]

/**
 * Fields that trigger clarification when missing from FarmerProfile.
 */
export const CROP_CLARIFICATION_FIELDS = {
  'location.state': 'Farm state',
  'location.district': 'Farm district',
  'farm.soilType': 'Soil type',
  'farm.waterAvailability': 'Water / irrigation type',
  season: 'Target growing season (Kharif/Rabi/Zaid)',
}
