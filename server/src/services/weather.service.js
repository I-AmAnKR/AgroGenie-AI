/**
 * Weather service — Phase 10 update.
 *
 * Delegates to the weather provider factory.
 * Now supports both mock and real (Open-Meteo) providers.
 *
 * This service is used by the legacy GET /api/v1/weather endpoint.
 * The Weather Agent in server/src/agents/weather/ uses the provider directly.
 */
import { getWeatherProvider } from '../providers/weather.provider.factory.js'

/**
 * @param {object} params
 * { location, district, state, lat, lon }
 */
export async function getWeather(params = {}) {
  const provider = getWeatherProvider()
  let data;

  if (params.lat && params.lon) {
  data = await provider.getCurrentWeather({
    latitude: Number(params.lat),
    longitude: Number(params.lon),
    locationName: params.location ?? "Current Location",
  });
} else {
  data = await provider.getWeatherByLocation({
    district: params.district ?? params.location ?? null,
    state: params.state ?? null,
  });
}
  // Return shape compatible with legacy controller/test expectations
  // Include both `metadata` (new) and `source` (legacy alias) for backward compat
  return {
    location: data.location,
    current: data.current,
    forecast: data.forecast,
    metadata: data.metadata,
    source: {
      isDemo: data.metadata?.isDemo ?? true,
      provider: data.metadata?.provider ?? 'unknown',
      fetchedAt: data.metadata?.fetchedAt ?? new Date().toISOString(),
    },
  }
}

/**
 * Get farming impact advice for a location.
 * This is a simplified advisory using weather data.
 * @param {object} params - { location, district, state, crop }
 */
export async function getFarmingAdvice(params = {}) {
  const provider = getWeatherProvider()

  const data = await provider.getWeatherByLocation({
    lat: params.lat,
    lon: params.lon,
    district: params.district ?? params.location ?? null,
    state: params.state ?? null,
  })

  return {
    location: data.location,
    impacts: [],
    alerts: [],
    isDemo: data.metadata?.isDemo ?? true,
    metadata: data.metadata,
  }
}