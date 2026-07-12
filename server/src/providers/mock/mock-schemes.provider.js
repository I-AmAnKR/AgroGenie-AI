/**
 * Mock schemes provider.
 * Returns structured demo government scheme data.
 * Replaced by RAG-backed scheme agent in Phase 12.
 */
import { mockSchemes } from '../../data/mock/schemes.js'

export const mockSchemesProvider = {
  /**
   * Search/filter schemes.
   * @param {object} params - { query, category, state }
   * @returns {Promise<object>}
   */
  async getSchemes(params = {}) {
    let results = [...mockSchemes]

    if (params.category && params.category !== 'All') {
      results = results.filter((s) => s.category === params.category)
    }

    if (params.query) {
      const q = params.query.toLowerCase()
      results = results.filter(
        (s) =>
          s.schemeName.toLowerCase().includes(q) ||
          s.purpose.toLowerCase().includes(q) ||
          s.benefitSummary.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      )
    }

    return {
      schemes: results,
      count: results.length,
      isDemo: true,
      disclaimer:
        'All scheme information is based on publicly available guidelines. Final eligibility is determined by the responsible government authority.',
    }
  },

  /**
   * Get a single scheme by ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async getSchemeById(id) {
    const scheme = mockSchemes.find((s) => s.id === id)
    return scheme ?? null
  },
}
