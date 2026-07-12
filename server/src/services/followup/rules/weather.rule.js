import { FOLLOWUP_RULES } from '../../../config/followup.config.js'

/**
 * Weather rule for follow-up suggestions.
 */
export function evaluate(result, memory, explainability) {
  const suggestions = []
  
  if (result.weather?.current?.condition?.toLowerCase().includes('rain') || 
      result.weather?.forecast?.some(day => day.pop > FOLLOWUP_RULES.weather.rainProbabilityThreshold)) {
    suggestions.push({
      suggestion: 'Delay irrigation to save water and prevent root suffocation.',
      reason: 'High probability of rain in the current forecast.',
      priority: 'Warning'
    })
  }

  if (result.weather?.current?.temperatureC > FOLLOWUP_RULES.weather.highTempThreshold) {
    suggestions.push({
      suggestion: 'Provide shade or ensure adequate soil moisture for sensitive crops.',
      reason: `Temperature exceeds ${FOLLOWUP_RULES.weather.highTempThreshold}°C causing heat stress risk.`,
      priority: 'Warning'
    })
  }

  return suggestions
}
