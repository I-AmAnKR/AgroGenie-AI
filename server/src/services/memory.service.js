import { getFarmerMemory, updateFarmerMemory } from '../repositories/memory.repository.js'
import { createMemoryItem } from '../models/memory.schema.js'
import { getAiProvider } from '../providers/ai.provider.factory.js'
import logger from '../utils/logger.js'
import config from '../config/env.js'

/**
 * Memory Service — Phase 16A
 *
 * Handles memory summarization, compression, and deterministic fact extraction.
 */

const MAX_MEMORY_ARRAY_SIZE = config.memory.maxArraySize

/**
 * Deterministically extract structured facts from agent outputs.
 */
export function extractFactsFromAgent(intent, agentResult, memory) {
  let updated = false

  if (intent === 'DISEASE' && agentResult.disease?.primaryDisease) {
    memory.history.push(createMemoryItem({
      content: `Diagnosed with ${agentResult.disease.primaryDisease}`,
      sourceAgent: 'DiseaseAgent',
      confidence: agentResult.disease.confidenceLevel,
      metadata: { diseaseCode: agentResult.disease.primaryDisease }
    }))
    updated = true
  }

  if (intent === 'CROP_RECOMMENDATION' && agentResult.recommendation?.crop) {
    memory.recommendations.push(createMemoryItem({
      content: `Recommended crop: ${agentResult.recommendation.crop}`,
      sourceAgent: 'CropAgent',
      metadata: { crop: agentResult.recommendation.crop }
    }))
    updated = true
  }

  if (intent === 'WEATHER' && agentResult.message?.toLowerCase().includes('alert')) {
    memory.warnings.push(createMemoryItem({
      content: 'Weather alert issued',
      sourceAgent: 'WeatherAgent',
    }))
    updated = true
  }

  // Cap arrays
  if (memory.history.length > MAX_MEMORY_ARRAY_SIZE) {
    memory.history = memory.history.slice(-MAX_MEMORY_ARRAY_SIZE)
  }
  if (memory.recommendations.length > MAX_MEMORY_ARRAY_SIZE) {
    memory.recommendations = memory.recommendations.slice(-MAX_MEMORY_ARRAY_SIZE)
  }
  if (memory.warnings.length > MAX_MEMORY_ARRAY_SIZE) {
    memory.warnings = memory.warnings.slice(-MAX_MEMORY_ARRAY_SIZE)
  }

  return updated
}

/**
 * Summarize free-form conversation using Granite.
 * Must never invent memory.
 */
export async function summarizeConversation(messages) {
  if (!messages || messages.length === 0) return null

  const prompt = `
Extract only objective facts from the following conversation.
Do not invent or assume any information.
Keep it extremely concise. If there are no new facts, return "NO_FACTS".

Conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n')}
`
  try {
    const provider = getAiProvider()
    const aiResult = await provider.generate({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'You are an objective summarizer. Follow the instructions strictly.',
      parameters: { max_tokens: 150, temperature: 0.1 }
    })
    const summary = aiResult?.content
    if (summary && !summary.includes('NO_FACTS') && summary.trim().length > 5) {
      return summary.trim()
    }
  } catch (err) {
    logger.warn('Failed to summarize conversation with Granite', { error: err.message })
  }
  return null
}

/**
 * Main entry point for asynchronous memory summarization.
 * To be called after the response is sent to the user.
 */
export async function processConversationMemory(userId, intent, agentResult, messages) {
  try {
    const memory = await getFarmerMemory(userId)
    
    // 1. Deterministic Extraction
    let hasUpdates = extractFactsFromAgent(intent, agentResult, memory)

    // 2. Free-form Summarization (only on recent user messages to avoid duplicate summaries)
    // We only summarize if the user provided new context (e.g., in a general intent or if they stated a fact)
    if (intent === 'GENERAL' || intent === 'CLARIFICATION') {
      const recentMessages = messages.slice(-config.memory.summarizationMinMessages)
      const summary = await summarizeConversation(recentMessages)
      
      if (summary) {
        memory.facts.push(createMemoryItem({
          content: summary,
          sourceAgent: 'Granite',
        }))
        if (memory.facts.length > MAX_MEMORY_ARRAY_SIZE) {
          memory.facts = memory.facts.slice(-MAX_MEMORY_ARRAY_SIZE)
        }
        hasUpdates = true
      }
    }

    if (hasUpdates) {
      await updateFarmerMemory(userId, memory)
      logger.info('Updated farmer memory asynchronously', { userId, intent })
    }
  } catch (err) {
    logger.error('Error processing conversation memory', { error: err.message, userId })
  }
}
