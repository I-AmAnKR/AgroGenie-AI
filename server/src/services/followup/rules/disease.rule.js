import { FOLLOWUP_RULES } from '../../../config/followup.config.js'

/**
 * Disease rule for follow-up suggestions.
 */
export function evaluate(result, memory, explainability) {
  const suggestions = []
  
  if (result.data?.confidence >= FOLLOWUP_RULES.disease.confidenceThreshold) {
    const diseaseName = result.data.diseaseCandidates?.[0]?.name || 'the disease'
    suggestions.push({
      suggestion: `Inspect affected plants within 24 hours and apply recommended treatment for ${diseaseName}.`,
      reason: `Diagnostic confidence is ${(result.data.confidence * 100).toFixed(1)}%.`,
      priority: 'Critical'
    })
  }

  return suggestions
}
