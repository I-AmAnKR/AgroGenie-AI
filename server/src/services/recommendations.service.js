/**
 * Recommendations service.
 * In-memory mock store — replaced by MongoDB in Phase 5.
 */
import { mockCropRecommendations } from '../data/mock/cropRecommendations.js'

const mockHistory = [
  {
    id: 'rec-001',
    userId: 'demo-user',
    type: 'crop',
    createdAt: '2024-11-17T10:23:00Z',
    context: { state: 'Maharashtra', district: 'Nashik', season: 'Rabi', soilType: 'Loamy' },
    recommendations: mockCropRecommendations,
  },
  {
    id: 'rec-002',
    userId: 'demo-user',
    type: 'crop',
    createdAt: '2024-11-10T09:00:00Z',
    context: { state: 'Maharashtra', district: 'Nashik', season: 'Kharif', soilType: 'Loamy' },
    recommendations: mockCropRecommendations.slice(0, 2),
  },
]

/**
 * Get recommendation history for a user.
 * @param {string} userId
 */
export async function getRecommendations(userId) {
  return mockHistory.filter((r) => r.userId === userId)
}

/**
 * Get recent recommendations with optional limit.
 * @param {string} userId
 * @param {number} limit
 */
export async function getRecentRecommendations(userId, limit = 5) {
  const all = mockHistory.filter((r) => r.userId === userId)
  return all.slice(0, limit)
}
