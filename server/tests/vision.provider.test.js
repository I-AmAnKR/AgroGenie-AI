import { jest } from '@jest/globals'
import config from '../src/config/env.js'
import { getVisionProvider } from '../src/providers/vision.provider.factory.js'

describe('Vision Provider Factory', () => {
  
  beforeEach(async () => {
    jest.resetModules()
  })

  test('should return mock provider when useMocks is true', async () => {
    config.providers.useMocks = true
    const factory = await import('../src/providers/vision.provider.factory.js')
    const provider = factory.getVisionProvider()
    
    // We can just verify it has analyzeImage
    expect(provider).toHaveProperty('analyzeImage')
    expect(typeof provider.analyzeImage).toBe('function')
  })

  test('should return real provider when useMocks is false', async () => {
    config.providers.useMocks = false
    const factory = await import('../src/providers/vision.provider.factory.js')
    const provider = factory.getVisionProvider()
    
    expect(provider).toHaveProperty('analyzeImage')
    expect(typeof provider.analyzeImage).toBe('function')
    
    // Reset
    config.providers.useMocks = true
  })
})
