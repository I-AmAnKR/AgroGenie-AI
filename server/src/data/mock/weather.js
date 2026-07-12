/**
 * Mock weather data.
 * Replaced by live weather provider in Phase 10.
 */
export const mockCurrentWeather = {
  location: {
    name: 'Nashik',
    district: 'Nashik',
    state: 'Maharashtra',
    lat: 19.847,
    lon: 73.998,
  },
  current: {
    temperature: 24,
    feelsLike: 22,
    humidity: 68,
    windSpeed: 12,
    windDirection: 'NW',
    condition: 'Partly Cloudy',
    conditionCode: 'partly-cloudy',
    uvIndex: 5,
    visibility: 10,
    rainProbability: 30,
    rainfall24h: 2.4,
  },
  forecast: [
    { date: '2024-11-18', day: 'Mon', tempMin: 18, tempMax: 27, condition: 'Sunny', conditionCode: 'sunny', precipitation: 0, humidity: 55, rainProb: 5 },
    { date: '2024-11-19', day: 'Tue', tempMin: 19, tempMax: 26, condition: 'Partly Cloudy', conditionCode: 'partly-cloudy', precipitation: 2, humidity: 65, rainProb: 25 },
    { date: '2024-11-20', day: 'Wed', tempMin: 17, tempMax: 23, condition: 'Overcast', conditionCode: 'overcast', precipitation: 8, humidity: 80, rainProb: 70 },
    { date: '2024-11-21', day: 'Thu', tempMin: 16, tempMax: 21, condition: 'Light Rain', conditionCode: 'rain', precipitation: 18, humidity: 88, rainProb: 85 },
    { date: '2024-11-22', day: 'Fri', tempMin: 17, tempMax: 22, condition: 'Showers', conditionCode: 'showers', precipitation: 10, humidity: 82, rainProb: 65 },
    { date: '2024-11-23', day: 'Sat', tempMin: 18, tempMax: 25, condition: 'Partly Cloudy', conditionCode: 'partly-cloudy', precipitation: 3, humidity: 70, rainProb: 20 },
    { date: '2024-11-24', day: 'Sun', tempMin: 19, tempMax: 28, condition: 'Sunny', conditionCode: 'sunny', precipitation: 0, humidity: 58, rainProb: 5 },
  ],
  farmingImpact: {
    sowingSuitability: 'Moderate — rain expected mid-week. Consider delaying sowing by 3–4 days.',
    irrigationNeed: 'Low — rainfall forecast will supplement irrigation. Reduce schedule by 40%.',
    sprayingConditions: 'Poor — avoid spraying Wed–Thu due to high humidity and rainfall.',
    harvestRisk: 'Moderate — risk of fungal disease if harvested crops are left in field.',
    impacts: [
      { category: 'Sowing Suitability', status: 'caution', label: 'Moderate', detail: 'Rain expected mid-week. Consider delaying sowing by 3–4 days.', icon: 'seedling' },
      { category: 'Irrigation Need', status: 'good', label: 'Low', detail: 'Rainfall forecast will supplement irrigation. Reduce schedule by 40%.', icon: 'droplets' },
      { category: 'Spraying Conditions', status: 'poor', label: 'Avoid Wed–Thu', detail: 'High humidity and rainfall make pesticide application ineffective.', icon: 'spray' },
      { category: 'Harvest Risk', status: 'caution', label: 'Monitor', detail: 'Moderate risk of fungal disease if harvested crops are left in field.', icon: 'alert' },
    ],
  },
  alerts: [
    {
      id: 'wa1',
      type: 'warning',
      title: 'Moderate Rainfall Advisory',
      message: 'Rainfall of 15–20mm expected between Wednesday and Thursday. Plan field activities accordingly.',
      validUntil: '2024-11-22',
      source: 'IMD Regional (Demo)',
    },
  ],
  source: {
    name: 'Mock Weather Provider',
    lastUpdated: new Date().toISOString(),
    isDemo: true,
  },
}
