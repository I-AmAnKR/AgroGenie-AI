import { getCropRecommendations } from '../services/crop.service.js'
import { success } from '../utils/apiResponse.js'

export async function cropRecommendation(req, res) {
  const result = await getCropRecommendations(req.body)
  return success(res, result)
}
