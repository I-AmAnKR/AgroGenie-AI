/**
 * Mock disease advisory provider.
 * Returns structured demo disease analysis.
 * Replaced by IBM Vision + RAG disease agent in Phase 16.
 */
import { mockDiseaseResults } from '../../data/mock/diseaseResults.js'

export const mockDiseaseProvider = {
  /**
   * Analyze crop disease from symptom metadata.
   * @param {object} params - { crop, plantPart, symptomDescription }
   * @returns {Promise<object>}
   */
  async analyze(params = {}) {
    const result = { ...mockDiseaseResults.default }

    // Personalise the response with the submitted crop/part
    result.crop = params.crop ?? 'Unknown'
    result.plantPart = params.plantPart ?? 'Unspecified'
    result.symptomDescription = params.symptomDescription ?? ''

    return result
  },
}
