import { getDb } from '../services/db.service.js'
import { profileStore } from '../data/mock/farmerProfile.js'
import { createFarmerMemory } from '../models/memory.schema.js'

/**
 * Memory Repository — Phase 16A
 *
 * Interfaces with MongoDB to read/update the `memory` fields of the `FarmerProfile`.
 * Falls back to in-memory store if DB is not connected.
 */

function getCollection() {
  try {
    return getDb().collection('profiles')
  } catch {
    return null
  }
}

/**
 * Fetch the memory document from the FarmerProfile.
 * @param {string} userId
 */
export async function getFarmerMemory(userId) {
  const col = getCollection()
  if (col) {
    const profile = await col.findOne({ userId }, { projection: { memory: 1, _id: 0 } })
    return createFarmerMemory(profile?.memory ?? {})
  }

  const profile = profileStore.get(userId)
  return createFarmerMemory(profile?.memory ?? {})
}

/**
 * Update the memory document of the FarmerProfile.
 * @param {string} userId
 * @param {object} memoryUpdates - Structured updates for the memory
 */
export async function updateFarmerMemory(userId, memoryUpdates) {
  const col = getCollection()
  
  if (col) {
    // If profile doesn't exist, this will upsert (handled in a broader context typically, but we use updateOne with upsert here to be safe)
    await col.updateOne(
      { userId },
      { $set: { memory: memoryUpdates, updatedAt: new Date().toISOString() } },
      { upsert: true }
    )
  } else {
    const profile = profileStore.get(userId)
    if (profile) {
      profile.memory = memoryUpdates
      profile.updatedAt = new Date().toISOString()
      profileStore.set(userId, profile)
    }
  }
}
