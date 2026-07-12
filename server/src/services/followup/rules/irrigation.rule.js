import { FOLLOWUP_RULES } from '../../../config/followup.config.js'

/**
 * Irrigation rule for follow-up suggestions.
 */
export function evaluate(result, memory, explainability) {
  const suggestions = []
  
  const content = (result.answer || '').toLowerCase()
  if (content.includes('soil moisture is low') || content.includes('drought stress')) {
    suggestions.push({
      suggestion: 'Set up an automated or regular irrigation schedule.',
      reason: 'Low soil moisture or drought stress detected.',
      priority: 'Warning'
    })
  }

  return suggestions
}
