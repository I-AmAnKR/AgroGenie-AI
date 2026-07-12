/**
 * Context Middleware tests — Phase 9.
 *
 * Run: cd server && npm test -- --testPathPattern=agents/context
 */
import { normalizeFarmerContext } from '../middleware/context.middleware.js'

describe('normalizeFarmerContext', () => {
  it('normalizes a complete profile correctly', () => {
    const raw = {
      state: 'Maharashtra',
      district: 'Nashik',
      farmArea: 4.5,
      farmAreaUnit: 'acres',
      soilType: 'Loamy',
      irrigationType: 'Drip',
      currentCrop: 'Onion',
      previousCrops: ['Tomato', 'Wheat'],
      sowingDate: '2024-10-15',
      farmingObjective: 'income',
      preferredLanguage: 'hi',
    }
    const ctx = normalizeFarmerContext(raw)
    expect(ctx.location.state).toBe('Maharashtra')
    expect(ctx.location.district).toBe('Nashik')
    expect(ctx.farm.soilType).toBe('Loamy')
    expect(ctx.farm.irrigationType).toBe('Drip')
    expect(ctx.cropContext.currentCrop).toBe('Onion')
    expect(ctx.cropContext.previousCrops).toEqual(['Tomato', 'Wheat'])
    expect(ctx.preferences.language).toBe('hi')
    expect(ctx.preferences.objective).toBe('income')
  })

  it('returns safe defaults for null profile', () => {
    const ctx = normalizeFarmerContext(null)
    expect(ctx.location.state).toBeNull()
    expect(ctx.location.district).toBeNull()
    expect(ctx.farm.soilType).toBeNull()
    expect(ctx.cropContext.previousCrops).toEqual([])
    expect(ctx.preferences.language).toBe('en')
  })

  it('returns safe defaults for undefined profile', () => {
    const ctx = normalizeFarmerContext(undefined)
    expect(ctx.location.state).toBeNull()
  })

  it('does not include sensitive fields in output', () => {
    const raw = {
      state: 'Punjab',
      phone: '9876543210',
      aadhaar: '1234-5678-9012',
      bankAccount: 'XXXX1234',
    }
    const ctx = normalizeFarmerContext(raw)
    const serialized = JSON.stringify(ctx)
    expect(serialized).not.toContain('9876543210')
    expect(serialized).not.toContain('aadhaar')
    expect(serialized).not.toContain('bankAccount')
  })

  it('handles partial profiles gracefully', () => {
    const raw = { state: 'Haryana' }
    const ctx = normalizeFarmerContext(raw)
    expect(ctx.location.state).toBe('Haryana')
    expect(ctx.location.district).toBeNull()
    expect(ctx.farm.soilType).toBeNull()
    expect(ctx.preferences.language).toBe('en')
  })
})
