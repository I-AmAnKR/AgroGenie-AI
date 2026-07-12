/**
 * Farmer profile service.
 * In-memory store — replaced by MongoDB in Phase 5.
 *
 * NOTE: Data is NOT persisted between server restarts in Phase 4.
 * This will be replaced with MongoDB CRUD operations in Phase 5.
 */
import { profileStore, defaultProfile } from '../data/mock/farmerProfile.js'

/**
 * Get a farmer profile by userId.
 * @param {string} userId
 */
export async function getProfile(userId) {
  const profile = profileStore.get(userId)
  if (!profile) {
    // Auto-create a default profile for unknown user IDs in mock mode
    const newProfile = { ...defaultProfile, userId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    profileStore.set(userId, newProfile)
    return newProfile
  }
  return profile
}

/**
 * Update a farmer profile.
 * @param {string} userId
 * @param {object} updates
 */
export async function updateProfile(userId, updates) {
  const current = await getProfile(userId)
  const updated = { ...current, ...updates, userId, updatedAt: new Date().toISOString() }
  profileStore.set(userId, updated)
  return updated
}
