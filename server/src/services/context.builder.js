import { getFarmerMemory } from '../repositories/memory.repository.js'
import config from '../config/env.js'

/**
 * Context Builder — Phase 16B
 *
 * Retrieves short-term conversation memory and long-term farmer memory,
 * filters by TTL and agent relevance, and combines them into an injected context string.
 */

function isExpired(item) {
  const ageMs = Date.now() - new Date(item.updatedAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  
  if (item.sourceAgent === 'WeatherAgent' && ageDays > config.context.weatherTtlDays) return true
  if ((item.sourceAgent === 'MarketAgent' || item.content.toUpperCase().includes('MARKET')) && ageDays > config.context.marketTtlDays) return true
  if (item.sourceAgent === 'DiseaseAgent' && ageDays > config.context.diseaseTtlDays) return true
  if (item.sourceAgent === 'CropAgent' && ageDays > config.context.cropTtlDays) return true
  
  return false
}

function isRelevantForIntent(item, intent) {
  const isDisease = item.sourceAgent === 'DiseaseAgent'
  const isCrop = item.sourceAgent === 'CropAgent'
  const isWeather = item.sourceAgent === 'WeatherAgent'
  const isMarket = item.sourceAgent === 'MarketAgent' || item.content.toUpperCase().includes('MARKET')
  const isSummary = item.sourceAgent === 'Granite'
  
  switch (intent) {
    case 'WEATHER':
      return isWeather || isSummary
    case 'MARKET':
      return isMarket || isSummary
    case 'CROP_RECOMMENDATION':
      return isCrop || isDisease || isSummary
    case 'DISEASE':
      return isDisease || isCrop || isWeather || isSummary
    case 'SCHEME':
      return item.content.toUpperCase().includes('SCHEME') || isSummary
    case 'KNOWLEDGE':
    case 'GENERAL':
      return true // Knowledge can see all facts, heavily ranked by recency
    default:
      return true
  }
}

function scoreRelevance(item, intent) {
  let score = 0
  const ageMs = Date.now() - new Date(item.updatedAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  const ageHours = ageMs / (1000 * 60 * 60)
  
  const contentUpper = item.content.toUpperCase()
  const isDisease = item.sourceAgent === 'DiseaseAgent'
  const isCrop = item.sourceAgent === 'CropAgent'
  const isWeather = item.sourceAgent === 'WeatherAgent'
  const isMarket = item.sourceAgent === 'MarketAgent' || contentUpper.includes('MARKET')
  const isSummary = item.sourceAgent === 'Granite'

  if (isSummary && ageHours < 2) score += 1000
  else if (isDisease && ageDays <= 30) score += 900
  else if (isCrop && ageDays <= 30) score += 800
  else if (isWeather && ageDays <= 7) score += 700
  else if (isMarket) score += 600
  else if (isCrop && ageDays > 30) score += 500
  else if (isSummary && ageHours >= 2) score += 400
  else score += 100

  if (intent === 'DISEASE' && isDisease) score += 50
  if (intent === 'CROP_RECOMMENDATION' && isCrop) score += 50
  if (intent === 'WEATHER' && isWeather) score += 50
  if (intent === 'MARKET' && isMarket) score += 50
  
  return score
}

function buildPreferencesString(memory, intent) {
  const prefs = memory.preferences
  let p = `Language: ${prefs.preferredLanguage}`
  
  if (intent === 'WEATHER' || intent === 'GENERAL' || intent === 'KNOWLEDGE') {
    if (prefs.farmLocation) p += `, Location: ${prefs.farmLocation}`
  }
  if (intent === 'MARKET' || intent === 'CROP_RECOMMENDATION' || intent === 'SCHEME' || intent === 'DISEASE') {
    if (prefs.preferredCrops.length > 0) p += `, Crops: ${prefs.preferredCrops.join(', ')}`
  }
  if (intent === 'CROP_RECOMMENDATION' || intent === 'SCHEME') {
    if (prefs.soilType) p += `, Soil: ${prefs.soilType}`
    if (prefs.irrigationType) p += `, Irrigation: ${prefs.irrigationType}`
  }
  return p
}

export async function buildAgentContext(userId, intent) {
  const memory = await getFarmerMemory(userId)
  
  const allItems = [
    ...memory.facts,
    ...memory.history,
    ...memory.recommendations,
    ...memory.warnings
  ]

  // 1. Filter expired (TTL) and Agent Relevance
  const validItems = allItems.filter(item => !isExpired(item) && isRelevantForIntent(item, intent))

  // 2. Rank by relevance score
  const rankedItems = validItems
    .map(item => ({ ...item, score: scoreRelevance(item, intent) }))
    .sort((a, b) => b.score - a.score)

  // 3 & 4. Select highest priority and apply token budget limit (Max 5 items to prevent overflow)
  const MAX_ITEMS = config.context.maxItems
  const selectedItems = rankedItems.slice(0, MAX_ITEMS)
  const unselectedItems = rankedItems.slice(MAX_ITEMS)

  let contextStr = '--- FARMER CONTEXT & MEMORY ---\n'
  contextStr += `Preferences: ${buildPreferencesString(memory, intent)}\n`
  
  if (selectedItems.length > 0) {
    contextStr += '\nRelevant Historical Memory:\n'
    selectedItems.forEach(item => {
      contextStr += `- [${new Date(item.updatedAt).toISOString().split('T')[0]}] ${item.content} (Confidence: ${item.confidence})\n`
    })
    
    // 5. If still over budget, summarize remaining low priority items generically
    if (unselectedItems.length > 0) {
      contextStr += `- (Plus ${unselectedItems.length} older or less relevant records omitted to save space)\n`
    }
  } else {
    contextStr += '\nRelevant Historical Memory: None\n'
  }
  contextStr += '-------------------------------\n'

  return contextStr
}
