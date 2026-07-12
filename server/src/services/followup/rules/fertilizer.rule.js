import { FOLLOWUP_RULES } from '../../../config/followup.config.js'

/**
 * Fertilizer rule for follow-up suggestions.
 */
export function evaluate(result, memory, explainability) {
  const suggestions = []
  
  const content = (result.answer || '').toLowerCase()
  const defs = FOLLOWUP_RULES.fertilizer.deficienciesTrigger.map(d => d.toLowerCase())
  
  if (defs.some(d => content.includes(d + ' deficiency'))) {
    suggestions.push({
      suggestion: 'Recommend soil testing to accurately measure nutrient levels.',
      reason: 'A nutrient deficiency was mentioned in the diagnostic.',
      priority: 'Warning'
    })
  }

  return suggestions
}
