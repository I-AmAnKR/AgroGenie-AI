import crypto from 'crypto'

/**
 * Memory Schema — Phase 16A
 *
 * Plain JS factory consistent with Phase 5 architecture.
 * No Mongoose used.
 */

/**
 * Create a new memory item for arrays (facts, history, recommendations, warnings)
 */
export function createMemoryItem(data = {}) {
  const now = new Date().toISOString()
  return {
    id: data.id ?? crypto.randomUUID(),
    content: data.content ?? '',
    sourceAgent: data.sourceAgent ?? 'SYSTEM',
    confidence: data.confidence ?? 'MEDIUM',
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
    metadata: data.metadata ?? {},
  }
}

/**
 * Create a default memory structure for a FarmerProfile
 */
export function createFarmerMemory(data = {}) {
  return {
    preferences: {
      preferredLanguage: data.preferences?.preferredLanguage ?? 'en',
      preferredCrops: data.preferences?.preferredCrops ?? [],
      farmLocation: data.preferences?.farmLocation ?? null,
      soilType: data.preferences?.soilType ?? null,
      irrigationType: data.preferences?.irrigationType ?? null,
    },
    history: Array.isArray(data.history) ? data.history : [],
    facts: Array.isArray(data.facts) ? data.facts : [],
    recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
  }
}
