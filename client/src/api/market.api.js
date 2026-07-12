import axiosClient from './axiosClient.js'

/**
 * GET /api/v1/market/prices
 * Get mandi prices filtered by commodity, state, district, market.
 */
export async function getPrices(filters = {}) {
  return axiosClient.get('/market/prices', { params: filters })
}

/**
 * GET /api/v1/market/trends
 * Get price trend for a commodity.
 */
export async function getPriceTrend(commodity, market) {
  return axiosClient.get('/market/trends', { params: { commodity, market } })
}
