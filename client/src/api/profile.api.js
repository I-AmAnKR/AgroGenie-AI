import axiosClient from './axiosClient.js'

const DEFAULT_USER_ID = 'demo-user'

/**
 * GET /api/v1/profile/:userId
 */
export async function getProfile(userId = DEFAULT_USER_ID) {
  return axiosClient.get(`/profile/${userId}`)
}

/**
 * PUT /api/v1/profile/:userId
 */
export async function updateProfile(payload, userId = DEFAULT_USER_ID) {
  return axiosClient.put(`/profile/${userId}`, payload)
}
