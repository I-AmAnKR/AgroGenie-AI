import { getFarmerMemory } from '../repositories/memory.repository.js'
import config from '../config/env.js'

/**
 * Get formatted recommendation history.
 * @param {string} userId
 */
export async function getRecommendationHistory(userId) {
  const memory = await getFarmerMemory(userId)
  
  if (!memory || !memory.recommendations || memory.recommendations.length === 0) {
    return []
  }

  // Sort descending by createdAt
  const sorted = [...memory.recommendations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // Filter last N days and limit records
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - config.followup.historyDays)

  const recent = sorted.filter(r => new Date(r.createdAt) >= cutoffDate).slice(0, config.followup.historyLimit)

  // Format
  return recent.map((r, index) => {
    const daysAgo = Math.floor((new Date() - new Date(r.createdAt)) / (1000 * 60 * 60 * 24))
    const timeText = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`
    
    let prefix = 'Previous recommendation'
    if (index === 0) prefix = 'Last recommendation'

    return `${prefix}: ${r.content} (${timeText})`
  })
}
