import { getProfile, updateProfile } from '../services/profile.service.js'
import { success } from '../utils/apiResponse.js'

export async function profile(req, res) {
  const { userId } = req.params
  const result = await getProfile(userId)
  return success(res, result)
}

export async function updateProfileHandler(req, res) {
  const { userId } = req.params
  const result = await updateProfile(userId, req.body)
  return success(res, result)
}
