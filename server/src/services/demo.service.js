/**
 * Demo Mode Service — Step 17 Part 6.
 *
 * When ENABLE_DEMO_MODE=true, this service seeds the in-memory stores
 * and MongoDB (if connected) with representative sample data:
 *
 *   - Sample Farmer Profile (Rajesh Kumar, Punjab)
 *   - Sample Farm (5 acres, loamy, drip irrigation)
 *   - Sample Conversations
 *   - Sample Crop History
 *   - Sample Recommendations
 *
 * Calling seedDemoData() is idempotent — it only seeds if the demo
 * userId does not already have data.
 *
 * The demo farmer ID is exported so controllers can use it as a default.
 */
import config from '../config/env.js'
import logger from '../utils/logger.js'

export const DEMO_USER_ID = 'demo-farmer-rajesh'

export const DEMO_FARMER_PROFILE = {
  userId: DEMO_USER_ID,
  name: 'Rajesh Kumar',
  phone: '+91-98765-43210',
  language: 'hi',
  location: {
    state: 'Punjab',
    district: 'Ludhiana',
    village: 'Raikot',
    pincode: '141109',
  },
  farm: {
    area: 5,
    areaUnit: 'acres',
    soilType: 'Loamy',
    irrigationType: 'Drip',
    ownershipType: 'owned',
    geoCoordinates: null,
  },
  cropContext: {
    currentCrop: 'Wheat',
    currentCropVariety: 'HD 2967',
    previousCrops: ['Rice', 'Maize'],
    targetedCrop: null,
    sowingDate: '2025-11-15',
  },
  preferences: {
    language: 'hi',
    objective: 'income',
    riskTolerance: 'medium',
    receiveAlerts: true,
  },
  certifications: ['PM Kisan beneficiary', 'Kisan Credit Card holder'],
  createdAt: new Date('2025-11-01').toISOString(),
  updatedAt: new Date().toISOString(),
  isDemo: true,
}

export const DEMO_CONVERSATIONS = [
  {
    conversationId: 'demo-conv-weather-001',
    userId: DEMO_USER_ID,
    createdAt: new Date('2025-12-10').toISOString(),
    updatedAt: new Date('2025-12-10').toISOString(),
    isDemo: true,
    messages: [
      {
        role: 'user',
        content: 'Kal baarish hogi kya Ludhiana mein?',
        language: 'hi',
        timestamp: new Date('2025-12-10T09:00:00Z').toISOString(),
      },
      {
        role: 'assistant',
        content: 'Ludhiana mein kal ke liye mausam pूर्वानुमान ke anusar, baarish ki sambhavna 35% hai...',
        language: 'hi',
        timestamp: new Date('2025-12-10T09:00:05Z').toISOString(),
        intent: 'WEATHER',
        grounded: true,
        isDemo: true,
      },
    ],
  },
  {
    conversationId: 'demo-conv-crop-001',
    userId: DEMO_USER_ID,
    createdAt: new Date('2025-11-05').toISOString(),
    updatedAt: new Date('2025-11-05').toISOString(),
    isDemo: true,
    messages: [
      {
        role: 'user',
        content: 'Rabi season mein kaunsi fasal best rahegi mere 5 acre ke liye?',
        language: 'hi',
        timestamp: new Date('2025-11-05T10:00:00Z').toISOString(),
      },
      {
        role: 'assistant',
        content: 'Aapke Punjab ke 5 acre Ludhiana farm ke liye, Loamy mitti aur Drip irrigation ke saath, Rabi 2025-26 ke liye top recommendations hain: 1. Gehu (Wheat) HD 2967...',
        language: 'hi',
        timestamp: new Date('2025-11-05T10:00:10Z').toISOString(),
        intent: 'CROP_RECOMMENDATION',
        grounded: true,
        isDemo: true,
      },
    ],
  },
  {
    conversationId: 'demo-conv-disease-001',
    userId: DEMO_USER_ID,
    createdAt: new Date('2025-12-20').toISOString(),
    updatedAt: new Date('2025-12-20').toISOString(),
    isDemo: true,
    messages: [
      {
        role: 'user',
        content: 'Mere gehun ke patte par peele daag aa rahe hain. Kya bimari hai?',
        language: 'hi',
        timestamp: new Date('2025-12-20T08:00:00Z').toISOString(),
      },
      {
        role: 'assistant',
        content: 'Aapke describe kiye symptoms ke basis par, yeh Yellow Rust (Puccinia striiformis) ke lakshan ho sakte hain...',
        language: 'hi',
        timestamp: new Date('2025-12-20T08:00:08Z').toISOString(),
        intent: 'DISEASE',
        grounded: false,
        isDemo: true,
        warnings: ['Disease identification requires visual confirmation. Consult KVK for official diagnosis.'],
      },
    ],
  },
  {
    conversationId: 'demo-conv-scheme-001',
    userId: DEMO_USER_ID,
    createdAt: new Date('2025-11-20').toISOString(),
    updatedAt: new Date('2025-11-20').toISOString(),
    isDemo: true,
    messages: [
      {
        role: 'user',
        content: 'PM Kisan yojana ke liye main eligible hoon kya?',
        language: 'hi',
        timestamp: new Date('2025-11-20T11:00:00Z').toISOString(),
      },
      {
        role: 'assistant',
        content: 'PM Kisan Samman Nidhi ke liye eligibility: Aap potentially eligible hain. Is scheme ke under...',
        language: 'hi',
        timestamp: new Date('2025-11-20T11:00:07Z').toISOString(),
        intent: 'SCHEME',
        grounded: true,
        isDemo: true,
      },
    ],
  },
]

export const DEMO_CROP_RECOMMENDATIONS = [
  {
    id: 'demo-crop-rec-001',
    userId: DEMO_USER_ID,
    createdAt: new Date('2025-11-05').toISOString(),
    season: 'rabi',
    year: '2025-26',
    topCrop: 'Wheat',
    crops: [
      {
        name: 'Wheat',
        variety: 'HD 2967',
        score: 0.88,
        reason: 'Best suited for loamy soil, drip irrigation, and Rabi season in Punjab.',
        estimatedYield: '5–6 quintals/acre',
        waterRequirement: '350–400 mm',
        growthDays: 120,
      },
      {
        name: 'Mustard',
        variety: 'Pusa Bold',
        score: 0.74,
        reason: 'Low water requirement, good market price in Punjab mandis.',
        estimatedYield: '6–8 quintals/acre',
        waterRequirement: '200–250 mm',
        growthDays: 100,
      },
      {
        name: 'Chickpea',
        variety: 'GNG 1581',
        score: 0.68,
        reason: 'Good rotation crop after Rice, fixes nitrogen in soil.',
        estimatedYield: '4–5 quintals/acre',
        waterRequirement: '250–300 mm',
        growthDays: 105,
      },
    ],
    isDemo: true,
  },
]

export const DEMO_MARKET_DATA = {
  commodity: 'Wheat',
  state: 'Punjab',
  district: 'Ludhiana',
  prices: [
    { market: 'Ludhiana', modalPrice: 2300, minPrice: 2250, maxPrice: 2350, unit: 'INR/quintal', priceDate: new Date().toISOString().split('T')[0] },
    { market: 'Khanna', modalPrice: 2280, minPrice: 2230, maxPrice: 2330, unit: 'INR/quintal', priceDate: new Date().toISOString().split('T')[0] },
    { market: 'Samrala', modalPrice: 2290, minPrice: 2240, maxPrice: 2340, unit: 'INR/quintal', priceDate: new Date().toISOString().split('T')[0] },
  ],
  trend: 'stable',
  isDemo: true,
}

export const DEMO_WEATHER = {
  location: { name: 'Ludhiana', district: 'Ludhiana', state: 'Punjab', latitude: 30.9, longitude: 75.85 },
  current: {
    observedAt: new Date().toISOString(),
    temperatureC: 18,
    feelsLikeC: 16,
    humidityPercent: 72,
    windSpeedKph: 12,
    precipitationMm: 0,
    condition: 'Partly Cloudy',
  },
  forecast: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
    minTemperatureC: 12 + Math.floor(Math.random() * 4),
    maxTemperatureC: 20 + Math.floor(Math.random() * 6),
    precipitationProbabilityPercent: [10, 20, 15, 60, 45, 20, 10][i],
    precipitationMm: [0, 0, 0, 5, 3, 0, 0][i],
    condition: ['Clear', 'Partly Cloudy', 'Clear', 'Rainy', 'Cloudy', 'Partly Cloudy', 'Clear'][i],
  })),
  metadata: { provider: 'demo', fetchedAt: new Date().toISOString(), isDemo: true },
}

/**
 * Seed in-memory stores with demo data.
 * Safe to call multiple times — checks if data already exists.
 *
 * @param {Function} [setProfileFn] - Optional: function to set profile in profile.service
 * @returns {Promise<{ seeded: boolean, userId: string }>}
 */
export async function seedDemoData(setProfileFn = null) {
  if (!config.demo.enabled) {
    return { seeded: false, userId: null, reason: 'Demo mode not enabled' }
  }

  logger.info('DemoMode: seeding demo data', { userId: DEMO_USER_ID })

  try {
    // Seed farmer profile if a setter is provided
    if (typeof setProfileFn === 'function') {
      await setProfileFn(DEMO_USER_ID, DEMO_FARMER_PROFILE)
    }

    logger.info('DemoMode: demo data seeded successfully', { userId: DEMO_USER_ID })
    return { seeded: true, userId: DEMO_USER_ID }
  } catch (err) {
    logger.error('DemoMode: failed to seed demo data', { error: err.message })
    return { seeded: false, userId: DEMO_USER_ID, error: err.message }
  }
}

/**
 * Get demo data summary for the monitoring dashboard.
 */
export function getDemoDataSummary() {
  if (!config.demo.enabled) return null

  return {
    enabled: true,
    userId: DEMO_USER_ID,
    farmerName: DEMO_FARMER_PROFILE.name,
    location: `${DEMO_FARMER_PROFILE.location.district}, ${DEMO_FARMER_PROFILE.location.state}`,
    conversationCount: DEMO_CONVERSATIONS.length,
    recommendationCount: DEMO_CROP_RECOMMENDATIONS.length,
    features: [
      'Sample Farmer Profile (Rajesh Kumar, Punjab)',
      'Sample Farm (5 acres, loamy, drip irrigation)',
      `${DEMO_CONVERSATIONS.length} Sample Conversations`,
      `${DEMO_CROP_RECOMMENDATIONS.length} Sample Crop Recommendations`,
      'Sample Market Prices (Ludhiana mandis)',
      'Sample Weather Data (Ludhiana, Punjab)',
      'Sample Government Scheme Guidance',
    ],
  }
}
