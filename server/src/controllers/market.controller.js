import { getMarketPrices, getMarketTrend } from '../services/market.service.js'
import { success } from '../utils/apiResponse.js'

export async function marketPrices(req, res) {
  const { commodity, state, district, market, fromDate, toDate } = req.query
  const result = await getMarketPrices({ commodity, state, district, market, fromDate, toDate })
  return success(res, result)
}

export async function marketTrend(req, res) {
  const { commodity, market } = req.query
  const result = await getMarketTrend(commodity, market)
  return success(res, result)
}
