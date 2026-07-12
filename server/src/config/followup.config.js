import config from '../config/env.js'

/**
 * Configuration for Follow-up rules and thresholds.
 * All values are read from environment variables via env.js.
 */
export const FOLLOWUP_RULES = {
  weather: {
    rainProbabilityThreshold: config.followup.weatherRainThreshold,
    highTempThreshold: config.followup.weatherHighTempThreshold
  },
  disease: {
    confidenceThreshold: config.followup.diseaseConfidenceThreshold
  },
  market: {
    priceSpikeThreshold: config.followup.marketPriceSpikeThreshold,
    priceDropThreshold: config.followup.marketPriceDropThreshold
  },
  fertilizer: {
    deficienciesTrigger: ['Nitrogen', 'Phosphorus', 'Potassium']
  },
  irrigation: {
    lowMoistureThreshold: 30
  },
  seasonal: {
    daysBeforeSowing: 14,
    daysBeforeHarvest: 14
  }
}
