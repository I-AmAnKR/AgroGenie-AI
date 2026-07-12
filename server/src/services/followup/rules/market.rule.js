import { FOLLOWUP_RULES } from '../../../config/followup.config.js'

/**
 * Market rule for follow-up suggestions.
 */
export function evaluate(result, memory, explainability) {
  const suggestions = []
  
  if (result.market) {
    const { currentPrice, previousPrice, commodity } = result.market
    if (currentPrice && previousPrice) {
      const diffPercent = ((currentPrice - previousPrice) / previousPrice) * 100
      
      if (diffPercent >= FOLLOWUP_RULES.market.priceSpikeThreshold) {
        suggestions.push({
          suggestion: `Monitor ${commodity} prices closely before selling.`,
          reason: `Price has increased by ${diffPercent.toFixed(1)}% compared to the previous week.`,
          priority: 'Info'
        })
      } else if (diffPercent <= -FOLLOWUP_RULES.market.priceDropThreshold) {
        suggestions.push({
          suggestion: `Consider holding ${commodity} inventory if viable.`,
          reason: `Price has dropped by ${Math.abs(diffPercent).toFixed(1)}% compared to the previous week.`,
          priority: 'Warning'
        })
      }
    }
  }

  return suggestions
}
