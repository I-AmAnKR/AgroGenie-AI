/**
 * Weather Agent schema — Phase 10.
 *
 * Documents the Weather Agent result contract.
 * The agent now returns live weather data + Granite agricultural advisory.
 */
export const WEATHER_AGENT_SCHEMA = {
  intent: 'WEATHER',
  agentsUsed: ['WeatherAgent', 'Weather Provider (open-meteo)', 'IBM Granite'],
  status: 'success',

  // Extended fields (beyond base agentResult contract)
  weather: {
    current: {
      observedAt: 'ISO 8601 string',
      temperatureC: 'number|null',
      feelsLikeC: 'number|null',
      humidityPercent: 'number|null',
      windSpeedKph: 'number|null',
      precipitationMm: 'number|null',
      condition: 'string',
    },
    forecast: [
      {
        date: 'YYYY-MM-DD',
        minTemperatureC: 'number|null',
        maxTemperatureC: 'number|null',
        precipitationProbabilityPercent: 'number|null',
        precipitationMm: 'number|null',
        humidityPercent: 'number|null',
        windSpeedKph: 'number|null',
        condition: 'string',
      },
    ],
  },

  sources: [
    {
      sourceType: 'weather_api',
      provider: 'open-meteo',
      location: 'string',
      observedAt: 'ISO 8601 string|null',
      fetchedAt: 'ISO 8601 string|null',
      cacheHit: 'boolean',
      isDemo: 'boolean',
    },
  ],
}
