import { rules } from './followup/rules/index.js'
import config from '../config/env.js'
import logger from '../utils/logger.js'

const PRIORITY_RANK = {
  'Critical': 3,
  'Warning': 2,
  'Info': 1
}

/**
 * Generate smart follow-up suggestions based on deterministic rules.
 * @param {object} result - Normalized agent result.
 * @param {object} memory - Farmer memory (profile.memory).
 * @param {object} explainability - Explainability output.
 * @returns {Array} List of top follow-up suggestions.
 */
export function generateFollowUp(result, memory, explainability) {
  let suggestions = []

  // Execute all rules
  for (const rule of rules) {
    try {
      const ruleSuggestions = rule.evaluate(result, memory, explainability)
      if (Array.isArray(ruleSuggestions)) {
        suggestions.push(...ruleSuggestions)
      }
    } catch (err) {
      // Log error but continue with other rules
      logger.error('Follow-up rule evaluation failed', { rule: rule?.constructor?.name, error: err.message })
    }
  }

  // Deduplicate by suggestion text
  const uniqueSuggestionsMap = new Map()
  for (const s of suggestions) {
    if (!uniqueSuggestionsMap.has(s.suggestion)) {
      uniqueSuggestionsMap.set(s.suggestion, s)
    } else {
      // If a duplicate exists, keep the one with higher priority
      const existing = uniqueSuggestionsMap.get(s.suggestion)
      if (PRIORITY_RANK[s.priority] > PRIORITY_RANK[existing.priority]) {
        uniqueSuggestionsMap.set(s.suggestion, s)
      }
    }
  }

  const uniqueSuggestions = Array.from(uniqueSuggestionsMap.values())

  // Sort by priority (descending)
  uniqueSuggestions.sort((a, b) => {
    return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0)
  })

  // Return top N (controlled by config)
  return uniqueSuggestions.slice(0, config.followup.maxSuggestions)
}
