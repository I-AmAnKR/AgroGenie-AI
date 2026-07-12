import { FOLLOWUP_RULES } from '../../../config/followup.config.js'

/**
 * Seasonal rule for follow-up suggestions.
 */
export function evaluate(result, memory, explainability) {
  const suggestions = []
  
  // Example simplistic seasonal check for demonstration.
  // In a real system, we'd check dates relative to a farmer's crop calendar in memory.
  const content = (result.answer || '').toLowerCase()
  if (content.includes('sowing season begins')) {
    suggestions.push({
      suggestion: 'Prepare seed treatment and secure necessary inputs.',
      reason: 'Sowing season is approaching.',
      priority: 'Info'
    })
  }

  return suggestions
}
