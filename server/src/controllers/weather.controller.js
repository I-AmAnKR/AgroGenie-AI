import { getWeather, getFarmingAdvice } from '../services/weather.service.js'
import { success } from '../utils/apiResponse.js'

export async function weather(req, res) {
  const { location, district, state, lat, lon } = req.query
  const result = await getWeather({ location, district, state, lat, lon })
  return success(res, result)
}

export async function weatherAdvice(req, res) {
  const { location, district, state, crop } = req.body
  const result = await getFarmingAdvice({ location, district, state, crop })
  return success(res, result)
}
