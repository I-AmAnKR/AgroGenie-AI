import { getRecommendations, getRecentRecommendations } from '../services/recommendations.service.js'
import { success } from '../utils/apiResponse.js'

export async function recommendations(req, res) {
  const { userId } = req.params
  const result = await getRecommendations(userId)
  return success(res, { recommendations: result })
}

export async function recentRecommendations(req, res) {
  const { userId } = req.params
  const limit = parseInt(req.query.limit ?? '5', 10)
  const result = await getRecentRecommendations(userId, limit)
  return success(res, { recommendations: result })
}
