import axiosClient from './axiosClient.js'

/**
 * GET /api/v1/weather
 * Get weather data for a location.
 */
export async function getCurrentWeather(_lat, _lon, params = {}) {
  return axiosClient.get('/weather', {
    params: {
      lat: _lat,
      lon: _lon,
      ...params,
    },
  })
}

/**
 * GET /api/v1/weather
 * Get 7-day forecast — included in the main weather response.
 */
export async function getForecast(_lat, _lon) {
  const result = await axiosClient.get('/weather', { params: { lat: _lat, lon: _lon } })
  // forecast is nested inside the main weather response
  return { success: true, data: result.data?.forecast ?? result.forecast ?? [] }
}

/**
 * POST /api/v1/weather/advice
 * Get farming impact advice.
 */
export async function getFarmingImpact(lat, lon, crop) {
  return axiosClient.post('/weather/advice', { lat, lon, crop })
}
