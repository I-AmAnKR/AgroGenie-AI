import axiosClient from './axiosClient.js'

/**
 * GET /api/v1/schemes
 * Search/filter government schemes.
 */
export async function searchSchemes(query = '', category = 'All', state = '') {
  return axiosClient.get('/schemes', {
    params: {
      query: query || undefined,
      category: category !== 'All' ? category : undefined,
      state: state || undefined,
    },
  })
}

/**
 * GET /api/v1/schemes/:id
 * Get a single scheme by ID.
 */
export async function getSchemeById(id) {
  return axiosClient.get(`/schemes/${id}`)
}
