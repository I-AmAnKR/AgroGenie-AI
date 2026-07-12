import { getFarmerMemory } from '../repositories/memory.repository.js'

/**
 * Get formatted recent activity timeline.
 * @param {string} userId
 */
export async function getActivityTimeline(userId) {
  const memory = await getFarmerMemory(userId)
  
  if (!memory) {
    return []
  }

  const activities = []

  // Add history items
  if (Array.isArray(memory.history)) {
    memory.history.forEach(h => {
      activities.push({
        type: 'history',
        content: h.content,
        timestamp: h.createdAt
      })
    })
  }

  // Add warning items
  if (Array.isArray(memory.warnings)) {
    memory.warnings.forEach(w => {
      activities.push({
        type: 'warning',
        content: w.content,
        timestamp: w.createdAt
      })
    })
  }
  
  // Add facts items
  if (Array.isArray(memory.facts)) {
    memory.facts.forEach(f => {
      activities.push({
        type: 'fact',
        content: f.content,
        timestamp: f.createdAt
      })
    })
  }

  // Sort descending by timestamp
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))

  // Limit to top 15 activities
  return activities.slice(0, 15)
}
