/**
 * Mock mandi market price data.
 * Replaced by live Agmarknet provider in Phase 11.
 */
export const mockMarketPrices = [
  { id: 'm1', commodity: 'Onion', market: 'Lasalgaon', district: 'Nashik', state: 'Maharashtra', minPrice: 1200, maxPrice: 2100, modalPrice: 1750, unit: 'INR/quintal', date: '2024-11-17', trend: 'up', trendPct: 8, isDemo: true },
  { id: 'm2', commodity: 'Onion', market: 'Pimpalgaon Baswant', district: 'Nashik', state: 'Maharashtra', minPrice: 1150, maxPrice: 2050, modalPrice: 1680, unit: 'INR/quintal', date: '2024-11-17', trend: 'up', trendPct: 5, isDemo: true },
  { id: 'm3', commodity: 'Onion', market: 'Malegaon', district: 'Nashik', state: 'Maharashtra', minPrice: 1300, maxPrice: 2200, modalPrice: 1800, unit: 'INR/quintal', date: '2024-11-17', trend: 'stable', trendPct: 1, isDemo: true },
  { id: 'm4', commodity: 'Tomato', market: 'Pune', district: 'Pune', state: 'Maharashtra', minPrice: 800, maxPrice: 1400, modalPrice: 1100, unit: 'INR/quintal', date: '2024-11-17', trend: 'down', trendPct: -12, isDemo: true },
  { id: 'm5', commodity: 'Tomato', market: 'Nashik', district: 'Nashik', state: 'Maharashtra', minPrice: 750, maxPrice: 1350, modalPrice: 1050, unit: 'INR/quintal', date: '2024-11-17', trend: 'down', trendPct: -9, isDemo: true },
  { id: 'm6', commodity: 'Wheat', market: 'Dhule', district: 'Dhule', state: 'Maharashtra', minPrice: 2100, maxPrice: 2400, modalPrice: 2280, unit: 'INR/quintal', date: '2024-11-17', trend: 'stable', trendPct: 2, isDemo: true },
  { id: 'm7', commodity: 'Soybean', market: 'Latur', district: 'Latur', state: 'Maharashtra', minPrice: 4100, maxPrice: 4600, modalPrice: 4380, unit: 'INR/quintal', date: '2024-11-17', trend: 'up', trendPct: 3, isDemo: true },
  { id: 'm8', commodity: 'Cotton', market: 'Jalgaon', district: 'Jalgaon', state: 'Maharashtra', minPrice: 6200, maxPrice: 7100, modalPrice: 6650, unit: 'INR/quintal', date: '2024-11-17', trend: 'stable', trendPct: 0, isDemo: true },
]

export const mockPriceTrend = [
  { date: 'Nov 11', price: 1580 },
  { date: 'Nov 12', price: 1620 },
  { date: 'Nov 13', price: 1540 },
  { date: 'Nov 14', price: 1600 },
  { date: 'Nov 15', price: 1680 },
  { date: 'Nov 16', price: 1710 },
  { date: 'Nov 17', price: 1750 },
]
