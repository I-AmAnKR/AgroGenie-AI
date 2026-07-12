/**
 * Mock farmer profile.
 * In-memory store — replaced by MongoDB in Phase 5.
 */

// In-memory profile store keyed by userId
const profileStore = new Map()

// Seed default profile
const defaultProfile = {
  userId: 'demo-user',
  displayName: 'Ramesh Kumar',
  preferredLanguage: 'en',
  state: 'Maharashtra',
  district: 'Nashik',
  village: 'Sinnar',
  farmArea: 4.5,
  farmAreaUnit: 'acres',
  soilType: 'Loamy',
  irrigationType: 'Drip',
  currentCrop: 'Onion',
  sowingDate: '2024-10-15',
  previousCrops: ['Tomato', 'Wheat'],
  farmingObjective: 'Balanced recommendation',
  createdAt: '2024-09-01T00:00:00Z',
  updatedAt: '2024-11-01T00:00:00Z',
}

profileStore.set('demo-user', { ...defaultProfile })

export { profileStore, defaultProfile }
