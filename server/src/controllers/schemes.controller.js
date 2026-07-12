import { searchSchemes, getSchemeById } from '../services/schemes.service.js'
import { success, notFoundError } from '../utils/apiResponse.js'

export async function schemes(req, res) {
  const { query, category, state } = req.query
  const result = await searchSchemes({ query, category, state })
  return success(res, result)
}

export async function schemeById(req, res) {
  const { id } = req.params
  const scheme = await getSchemeById(id)
  if (!scheme) {
    return notFoundError(res, `Scheme with id '${id}' not found`)
  }
  return success(res, { scheme })
}
