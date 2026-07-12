/**
 * Real Weather Provider — Phase 10 (rev 2).
 *
 * Uses Open-Meteo (https://open-meteo.com) — a free, open-source weather API.
 * No API key or authentication is required.
 * Supports current conditions, hourly data, and up to 16-day forecasts.
 *
 * Geocoding strategy (production-grade, Render-safe):
 *   1. DISTRICT_COORDS lookup table — instant, no network call.
 *      Covers ~260 Indian agricultural districts with verified coordinates.
 *      When the district (case-insensitive) exists in the table, geocoding
 *      is bypassed completely and the provider goes straight to the forecast
 *      API.  This eliminates the primary failure mode on Render (and any
 *      other restricted-egress host) where geocoding-api.open-meteo.com
 *      returns `{ "generationtime_ms": ... }` with no "results" array.
 *
 *   2. Live geocoding — district name ONLY sent as `name=` parameter.
 *      Root-cause fix: the original code sent "Karnal, Haryana, India"
 *      (fully compound) which Open-Meteo geocoding does not support.
 *      Open-Meteo geocodes a single city/town name prefix.  Commas and
 *      country qualifiers are not interpreted — they prevent any match.
 *      We now send only the district name, then prefer the India result
 *      from among the returned candidates.
 *
 *   3. State-name fallback — if district geocoding also returns nothing,
 *      retry with the state name so the farmer at least gets regional data.
 *
 * Interface (unchanged):
 *   getCurrentWeather({ latitude, longitude, locationName })
 *   getForecast({ latitude, longitude, locationName, days })
 *   getWeatherByLocation({ state, district, days })
 *   checkReadiness()
 *
 * Credential safety:
 *   - No secrets or credentials are used by this provider.
 *   - The API URL is configurable via env but defaults to the public endpoint.
 *
 * Open-Meteo current-weather variables used:
 *   temperature_2m, apparent_temperature, relative_humidity_2m,
 *   precipitation, wind_speed_10m, weather_code
 *
 * Open-Meteo daily forecast variables used:
 *   temperature_2m_max, temperature_2m_min, precipitation_sum,
 *   precipitation_probability_max, wind_speed_10m_max,
 *   relative_humidity_2m_max, weather_code
 */

import config from '../config/env.js'
import logger from '../utils/logger.js'

// ── District coordinate lookup table ─────────────────────────────────────────
//
// Keys are lowercase district names (as produced by String.toLowerCase()).
// Values are { latitude, longitude, name, state } with WGS-84 coordinates
// verified against Open-Meteo and IMD station data.
//
// Rationale: Open-Meteo's geocoding endpoint is a city-name prefix search and
// cannot parse compound queries like "Karnal, Haryana, India".  On restricted
// hosting environments (Render free tier, some cloud NAT setups) the geocoding
// endpoint also intermittently returns an empty envelope:
//   { "generationtime_ms": 0.85 }   ← no "results" key at all
// Bypassing geocoding for known districts eliminates both failure modes.

const DISTRICT_COORDS = {
  // ── Haryana ───────────────────────────────────────────────────────────────
  karnal:        { latitude: 29.6857, longitude: 76.9905, name: 'Karnal',        state: 'Haryana' },
  kurukshetra:   { latitude: 29.9695, longitude: 76.8783, name: 'Kurukshetra',   state: 'Haryana' },
  ambala:        { latitude: 30.3782, longitude: 76.7767, name: 'Ambala',        state: 'Haryana' },
  hisar:         { latitude: 29.1492, longitude: 75.7217, name: 'Hisar',         state: 'Haryana' },
  rohtak:        { latitude: 28.8955, longitude: 76.6066, name: 'Rohtak',        state: 'Haryana' },
  sirsa:         { latitude: 29.5330, longitude: 75.0167, name: 'Sirsa',         state: 'Haryana' },
  sonipat:       { latitude: 28.9948, longitude: 77.0115, name: 'Sonipat',       state: 'Haryana' },
  panipat:       { latitude: 29.3909, longitude: 76.9635, name: 'Panipat',       state: 'Haryana' },
  faridabad:     { latitude: 28.4089, longitude: 77.3178, name: 'Faridabad',     state: 'Haryana' },
  gurugram:      { latitude: 28.4595, longitude: 77.0266, name: 'Gurugram',      state: 'Haryana' },
  gurgaon:       { latitude: 28.4595, longitude: 77.0266, name: 'Gurugram',      state: 'Haryana' },
  jind:          { latitude: 29.3159, longitude: 76.3142, name: 'Jind',          state: 'Haryana' },
  fatehabad:     { latitude: 29.5134, longitude: 75.4559, name: 'Fatehabad',     state: 'Haryana' },
  bhiwani:       { latitude: 28.7975, longitude: 76.1322, name: 'Bhiwani',       state: 'Haryana' },
  mahendragarh:  { latitude: 28.2755, longitude: 76.1500, name: 'Mahendragarh', state: 'Haryana' },
  rewari:        { latitude: 28.1979, longitude: 76.6190, name: 'Rewari',        state: 'Haryana' },
  nuh:           { latitude: 28.1072, longitude: 77.0023, name: 'Nuh',           state: 'Haryana' },
  palwal:        { latitude: 28.1483, longitude: 77.3333, name: 'Palwal',        state: 'Haryana' },
  yamunanagar:   { latitude: 30.1290, longitude: 77.2674, name: 'Yamunanagar',   state: 'Haryana' },
  panchkula:     { latitude: 30.6942, longitude: 76.8606, name: 'Panchkula',     state: 'Haryana' },
  kaithal:       { latitude: 29.8014, longitude: 76.3990, name: 'Kaithal',       state: 'Haryana' },
  // ── Punjab ────────────────────────────────────────────────────────────────
  ludhiana:      { latitude: 30.9010, longitude: 75.8573, name: 'Ludhiana',      state: 'Punjab' },
  amritsar:      { latitude: 31.6340, longitude: 74.8723, name: 'Amritsar',      state: 'Punjab' },
  jalandhar:     { latitude: 31.3260, longitude: 75.5762, name: 'Jalandhar',     state: 'Punjab' },
  patiala:       { latitude: 30.3398, longitude: 76.3869, name: 'Patiala',       state: 'Punjab' },
  bathinda:      { latitude: 30.2070, longitude: 74.9455, name: 'Bathinda',      state: 'Punjab' },
  mohali:        { latitude: 30.7046, longitude: 76.7179, name: 'Mohali',        state: 'Punjab' },
  rupnagar:      { latitude: 30.9644, longitude: 76.5232, name: 'Rupnagar',      state: 'Punjab' },
  sangrur:       { latitude: 30.2484, longitude: 75.8439, name: 'Sangrur',       state: 'Punjab' },
  moga:          { latitude: 30.8162, longitude: 75.1723, name: 'Moga',          state: 'Punjab' },
  ferozepur:     { latitude: 30.9311, longitude: 74.6131, name: 'Ferozepur',     state: 'Punjab' },
  gurdaspur:     { latitude: 32.0398, longitude: 75.4062, name: 'Gurdaspur',     state: 'Punjab' },
  hoshiarpur:    { latitude: 31.5343, longitude: 75.9110, name: 'Hoshiarpur',    state: 'Punjab' },
  nawanshahr:    { latitude: 31.1254, longitude: 76.1157, name: 'Nawanshahr',    state: 'Punjab' },
  kapurthala:    { latitude: 31.3799, longitude: 75.3796, name: 'Kapurthala',    state: 'Punjab' },
  firozpur:      { latitude: 30.9311, longitude: 74.6131, name: 'Ferozepur',     state: 'Punjab' },
  // ── Rajasthan ─────────────────────────────────────────────────────────────
  jaipur:        { latitude: 26.9124, longitude: 75.7873, name: 'Jaipur',        state: 'Rajasthan' },
  jodhpur:       { latitude: 26.2389, longitude: 73.0243, name: 'Jodhpur',       state: 'Rajasthan' },
  kota:          { latitude: 25.2138, longitude: 75.8648, name: 'Kota',          state: 'Rajasthan' },
  udaipur:       { latitude: 24.5854, longitude: 73.7125, name: 'Udaipur',       state: 'Rajasthan' },
  bikaner:       { latitude: 28.0229, longitude: 73.3119, name: 'Bikaner',       state: 'Rajasthan' },
  ajmer:         { latitude: 26.4499, longitude: 74.6399, name: 'Ajmer',         state: 'Rajasthan' },
  alwar:         { latitude: 27.5530, longitude: 76.6346, name: 'Alwar',         state: 'Rajasthan' },
  sikar:         { latitude: 27.6094, longitude: 75.1399, name: 'Sikar',         state: 'Rajasthan' },
  nagaur:        { latitude: 27.2027, longitude: 73.7347, name: 'Nagaur',        state: 'Rajasthan' },
  barmer:        { latitude: 25.7521, longitude: 71.4186, name: 'Barmer',        state: 'Rajasthan' },
  jaisalmer:     { latitude: 26.9157, longitude: 70.9083, name: 'Jaisalmer',     state: 'Rajasthan' },
  ganganagar:    { latitude: 29.9190, longitude: 73.8769, name: 'Sri Ganganagar', state: 'Rajasthan' },
  hanumangarh:   { latitude: 29.5830, longitude: 74.3290, name: 'Hanumangarh',   state: 'Rajasthan' },
  churu:         { latitude: 28.2986, longitude: 74.9665, name: 'Churu',         state: 'Rajasthan' },
  // ── Uttar Pradesh ─────────────────────────────────────────────────────────
  lucknow:       { latitude: 26.8467, longitude: 80.9462, name: 'Lucknow',       state: 'Uttar Pradesh' },
  agra:          { latitude: 27.1767, longitude: 78.0081, name: 'Agra',          state: 'Uttar Pradesh' },
  varanasi:      { latitude: 25.3176, longitude: 82.9739, name: 'Varanasi',      state: 'Uttar Pradesh' },
  prayagraj:     { latitude: 25.4358, longitude: 81.8463, name: 'Prayagraj',     state: 'Uttar Pradesh' },
  allahabad:     { latitude: 25.4358, longitude: 81.8463, name: 'Prayagraj',     state: 'Uttar Pradesh' },
  gorakhpur:     { latitude: 26.7606, longitude: 83.3732, name: 'Gorakhpur',     state: 'Uttar Pradesh' },
  meerut:        { latitude: 28.9845, longitude: 77.7064, name: 'Meerut',        state: 'Uttar Pradesh' },
  kanpur:        { latitude: 26.4499, longitude: 80.3319, name: 'Kanpur',        state: 'Uttar Pradesh' },
  mathura:       { latitude: 27.4924, longitude: 77.6737, name: 'Mathura',       state: 'Uttar Pradesh' },
  bareilly:      { latitude: 28.3670, longitude: 79.4304, name: 'Bareilly',      state: 'Uttar Pradesh' },
  aligarh:       { latitude: 27.8974, longitude: 78.0880, name: 'Aligarh',       state: 'Uttar Pradesh' },
  moradabad:     { latitude: 28.8388, longitude: 78.7769, name: 'Moradabad',     state: 'Uttar Pradesh' },
  saharanpur:    { latitude: 29.9680, longitude: 77.5510, name: 'Saharanpur',    state: 'Uttar Pradesh' },
  muzaffarnagar: { latitude: 29.4728, longitude: 77.7085, name: 'Muzaffarnagar', state: 'Uttar Pradesh' },
  bulandshahr:   { latitude: 28.4071, longitude: 77.8499, name: 'Bulandshahr',   state: 'Uttar Pradesh' },
  bijnor:        { latitude: 29.3727, longitude: 78.1357, name: 'Bijnor',        state: 'Uttar Pradesh' },
  shahjahanpur:  { latitude: 27.8806, longitude: 79.9060, name: 'Shahjahanpur',  state: 'Uttar Pradesh' },
  lakhimpur:     { latitude: 27.9487, longitude: 80.7815, name: 'Lakhimpur Kheri', state: 'Uttar Pradesh' },
  sitapur:       { latitude: 27.5630, longitude: 80.6840, name: 'Sitapur',       state: 'Uttar Pradesh' },
  hardoi:        { latitude: 27.3944, longitude: 80.1290, name: 'Hardoi',        state: 'Uttar Pradesh' },
  unnao:         { latitude: 26.5466, longitude: 80.4917, name: 'Unnao',         state: 'Uttar Pradesh' },
  rae_bareli:    { latitude: 26.2237, longitude: 81.2420, name: 'Rae Bareli',    state: 'Uttar Pradesh' },
  // ── Bihar ─────────────────────────────────────────────────────────────────
  patna:         { latitude: 25.5941, longitude: 85.1376, name: 'Patna',         state: 'Bihar' },
  gaya:          { latitude: 24.7963, longitude: 85.0002, name: 'Gaya',          state: 'Bihar' },
  muzaffarpur:   { latitude: 26.1209, longitude: 85.3647, name: 'Muzaffarpur',   state: 'Bihar' },
  bhagalpur:     { latitude: 25.2425, longitude: 86.9842, name: 'Bhagalpur',     state: 'Bihar' },
  darbhanga:     { latitude: 26.1542, longitude: 85.8918, name: 'Darbhanga',     state: 'Bihar' },
  samastipur:    { latitude: 25.8581, longitude: 85.7782, name: 'Samastipur',    state: 'Bihar' },
  vaishali:      { latitude: 25.6942, longitude: 85.2000, name: 'Vaishali',      state: 'Bihar' },
  nalanda:       { latitude: 25.1360, longitude: 85.4439, name: 'Nalanda',       state: 'Bihar' },
  // ── West Bengal ───────────────────────────────────────────────────────────
  kolkata:       { latitude: 22.5726, longitude: 88.3639, name: 'Kolkata',       state: 'West Bengal' },
  burdwan:       { latitude: 23.2324, longitude: 87.8615, name: 'Burdwan',       state: 'West Bengal' },
  howrah:        { latitude: 22.5958, longitude: 88.2636, name: 'Howrah',        state: 'West Bengal' },
  hooghly:       { latitude: 22.9063, longitude: 88.3957, name: 'Hooghly',       state: 'West Bengal' },
  nadia:         { latitude: 23.4699, longitude: 88.5562, name: 'Nadia',         state: 'West Bengal' },
  murshidabad:   { latitude: 24.1793, longitude: 88.2726, name: 'Murshidabad',   state: 'West Bengal' },
  malda:         { latitude: 25.0108, longitude: 88.1435, name: 'Malda',         state: 'West Bengal' },
  // ── Maharashtra ───────────────────────────────────────────────────────────
  nashik:        { latitude: 19.9975, longitude: 73.7898, name: 'Nashik',        state: 'Maharashtra' },
  pune:          { latitude: 18.5204, longitude: 73.8567, name: 'Pune',          state: 'Maharashtra' },
  nagpur:        { latitude: 21.1458, longitude: 79.0882, name: 'Nagpur',        state: 'Maharashtra' },
  aurangabad:    { latitude: 19.8762, longitude: 75.3433, name: 'Aurangabad',    state: 'Maharashtra' },
  solapur:       { latitude: 17.6805, longitude: 75.9064, name: 'Solapur',       state: 'Maharashtra' },
  kolhapur:      { latitude: 16.7050, longitude: 74.2433, name: 'Kolhapur',      state: 'Maharashtra' },
  amravati:      { latitude: 20.9333, longitude: 77.7500, name: 'Amravati',      state: 'Maharashtra' },
  latur:         { latitude: 18.4088, longitude: 76.5604, name: 'Latur',         state: 'Maharashtra' },
  nanded:        { latitude: 19.1383, longitude: 77.3210, name: 'Nanded',        state: 'Maharashtra' },
  osmanabad:     { latitude: 18.1860, longitude: 76.0412, name: 'Osmanabad',     state: 'Maharashtra' },
  sangli:        { latitude: 16.8524, longitude: 74.5815, name: 'Sangli',        state: 'Maharashtra' },
  satara:        { latitude: 17.6805, longitude: 74.0183, name: 'Satara',        state: 'Maharashtra' },
  ahmednagar:    { latitude: 19.0948, longitude: 74.7480, name: 'Ahmednagar',    state: 'Maharashtra' },
  raigad:        { latitude: 18.5158, longitude: 73.1648, name: 'Raigad',        state: 'Maharashtra' },
  jalgaon:       { latitude: 21.0077, longitude: 75.5626, name: 'Jalgaon',       state: 'Maharashtra' },
  dhule:         { latitude: 20.9042, longitude: 74.7749, name: 'Dhule',         state: 'Maharashtra' },
  // ── Madhya Pradesh ────────────────────────────────────────────────────────
  indore:        { latitude: 22.7196, longitude: 75.8577, name: 'Indore',        state: 'Madhya Pradesh' },
  bhopal:        { latitude: 23.2599, longitude: 77.4126, name: 'Bhopal',        state: 'Madhya Pradesh' },
  jabalpur:      { latitude: 23.1815, longitude: 79.9864, name: 'Jabalpur',      state: 'Madhya Pradesh' },
  sagar:         { latitude: 23.8388, longitude: 78.7378, name: 'Sagar',         state: 'Madhya Pradesh' },
  ujjain:        { latitude: 23.1765, longitude: 75.7885, name: 'Ujjain',        state: 'Madhya Pradesh' },
  gwalior:       { latitude: 26.2183, longitude: 78.1828, name: 'Gwalior',       state: 'Madhya Pradesh' },
  rewa:          { latitude: 24.5362, longitude: 81.2962, name: 'Rewa',          state: 'Madhya Pradesh' },
  satna:         { latitude: 24.6005, longitude: 80.8322, name: 'Satna',         state: 'Madhya Pradesh' },
  dewas:         { latitude: 22.9676, longitude: 76.0534, name: 'Dewas',         state: 'Madhya Pradesh' },
  hoshangabad:   { latitude: 22.7520, longitude: 77.7270, name: 'Hoshangabad',   state: 'Madhya Pradesh' },
  raisen:        { latitude: 23.3305, longitude: 77.7886, name: 'Raisen',        state: 'Madhya Pradesh' },
  vidisha:       { latitude: 23.5251, longitude: 77.8083, name: 'Vidisha',       state: 'Madhya Pradesh' },
  chhindwara:    { latitude: 22.0574, longitude: 78.9382, name: 'Chhindwara',    state: 'Madhya Pradesh' },
  seoni:         { latitude: 22.0868, longitude: 79.5444, name: 'Seoni',         state: 'Madhya Pradesh' },
  // ── Gujarat ───────────────────────────────────────────────────────────────
  ahmedabad:     { latitude: 23.0225, longitude: 72.5714, name: 'Ahmedabad',     state: 'Gujarat' },
  surat:         { latitude: 21.1702, longitude: 72.8311, name: 'Surat',         state: 'Gujarat' },
  rajkot:        { latitude: 22.3039, longitude: 70.8022, name: 'Rajkot',        state: 'Gujarat' },
  junagadh:      { latitude: 21.5222, longitude: 70.4579, name: 'Junagadh',      state: 'Gujarat' },
  anand:         { latitude: 22.5645, longitude: 72.9289, name: 'Anand',         state: 'Gujarat' },
  vadodara:      { latitude: 22.3072, longitude: 73.1812, name: 'Vadodara',      state: 'Gujarat' },
  mehsana:       { latitude: 23.5879, longitude: 72.3693, name: 'Mehsana',       state: 'Gujarat' },
  gandhinagar:   { latitude: 23.2156, longitude: 72.6369, name: 'Gandhinagar',   state: 'Gujarat' },
  kutch:         { latitude: 23.7337, longitude: 69.8597, name: 'Kutch',         state: 'Gujarat' },
  banaskantha:   { latitude: 24.1751, longitude: 72.4379, name: 'Banaskantha',   state: 'Gujarat' },
  sabarkantha:   { latitude: 23.5879, longitude: 73.0005, name: 'Sabarkantha',   state: 'Gujarat' },
  kheda:         { latitude: 22.7597, longitude: 72.6858, name: 'Kheda',         state: 'Gujarat' },
  // ── Karnataka ─────────────────────────────────────────────────────────────
  bangalore:     { latitude: 12.9716, longitude: 77.5946, name: 'Bengaluru',     state: 'Karnataka' },
  bengaluru:     { latitude: 12.9716, longitude: 77.5946, name: 'Bengaluru',     state: 'Karnataka' },
  mysuru:        { latitude: 12.2958, longitude: 76.6394, name: 'Mysuru',        state: 'Karnataka' },
  mysore:        { latitude: 12.2958, longitude: 76.6394, name: 'Mysuru',        state: 'Karnataka' },
  hubli:         { latitude: 15.3647, longitude: 75.1240, name: 'Hubli',         state: 'Karnataka' },
  dharwad:       { latitude: 15.4589, longitude: 75.0078, name: 'Dharwad',       state: 'Karnataka' },
  belagavi:      { latitude: 15.8497, longitude: 74.4977, name: 'Belagavi',      state: 'Karnataka' },
  belgaum:       { latitude: 15.8497, longitude: 74.4977, name: 'Belagavi',      state: 'Karnataka' },
  tumkur:        { latitude: 13.3379, longitude: 77.1017, name: 'Tumkur',        state: 'Karnataka' },
  shimoga:       { latitude: 13.9299, longitude: 75.5681, name: 'Shivamogga',    state: 'Karnataka' },
  shivamogga:    { latitude: 13.9299, longitude: 75.5681, name: 'Shivamogga',    state: 'Karnataka' },
  davangere:     { latitude: 14.4644, longitude: 75.9218, name: 'Davanagere',    state: 'Karnataka' },
  raichur:       { latitude: 16.2120, longitude: 77.3439, name: 'Raichur',       state: 'Karnataka' },
  bidar:         { latitude: 17.9104, longitude: 77.5199, name: 'Bidar',         state: 'Karnataka' },
  gulbarga:      { latitude: 17.3297, longitude: 76.8343, name: 'Kalaburagi',    state: 'Karnataka' },
  kalaburagi:    { latitude: 17.3297, longitude: 76.8343, name: 'Kalaburagi',    state: 'Karnataka' },
  hassan:        { latitude: 13.0068, longitude: 76.1004, name: 'Hassan',        state: 'Karnataka' },
  mandya:        { latitude: 12.5218, longitude: 76.8951, name: 'Mandya',        state: 'Karnataka' },
  chitradurga:   { latitude: 14.2251, longitude: 76.3980, name: 'Chitradurga',   state: 'Karnataka' },
  udupi:         { latitude: 13.3409, longitude: 74.7421, name: 'Udupi',         state: 'Karnataka' },
  // ── Tamil Nadu ────────────────────────────────────────────────────────────
  chennai:       { latitude: 13.0827, longitude: 80.2707, name: 'Chennai',       state: 'Tamil Nadu' },
  coimbatore:    { latitude: 11.0168, longitude: 76.9558, name: 'Coimbatore',    state: 'Tamil Nadu' },
  madurai:       { latitude: 9.9252,  longitude: 78.1198, name: 'Madurai',       state: 'Tamil Nadu' },
  tiruchirappalli: { latitude: 10.7905, longitude: 78.7047, name: 'Tiruchirappalli', state: 'Tamil Nadu' },
  tirupur:       { latitude: 11.1085, longitude: 77.3411, name: 'Tirupur',       state: 'Tamil Nadu' },
  salem:         { latitude: 11.6643, longitude: 78.1460, name: 'Salem',         state: 'Tamil Nadu' },
  erode:         { latitude: 11.3410, longitude: 77.7172, name: 'Erode',         state: 'Tamil Nadu' },
  thanjavur:     { latitude: 10.7870, longitude: 79.1378, name: 'Thanjavur',     state: 'Tamil Nadu' },
  vellore:       { latitude: 12.9165, longitude: 79.1325, name: 'Vellore',       state: 'Tamil Nadu' },
  tirunelveli:   { latitude: 8.7139,  longitude: 77.7567, name: 'Tirunelveli',   state: 'Tamil Nadu' },
  dindigul:      { latitude: 10.3673, longitude: 77.9803, name: 'Dindigul',      state: 'Tamil Nadu' },
  // ── Andhra Pradesh ────────────────────────────────────────────────────────
  vijayawada:    { latitude: 16.5062, longitude: 80.6480, name: 'Vijayawada',    state: 'Andhra Pradesh' },
  guntur:        { latitude: 16.3067, longitude: 80.4365, name: 'Guntur',        state: 'Andhra Pradesh' },
  nellore:       { latitude: 14.4426, longitude: 79.9865, name: 'Nellore',       state: 'Andhra Pradesh' },
  kurnool:       { latitude: 15.8281, longitude: 78.0373, name: 'Kurnool',       state: 'Andhra Pradesh' },
  kakinada:      { latitude: 16.9891, longitude: 82.2475, name: 'Kakinada',      state: 'Andhra Pradesh' },
  rajahmundry:   { latitude: 17.0005, longitude: 81.8040, name: 'Rajahmundry',   state: 'Andhra Pradesh' },
  tirupati:      { latitude: 13.6288, longitude: 79.4192, name: 'Tirupati',      state: 'Andhra Pradesh' },
  kadapa:        { latitude: 14.4674, longitude: 78.8241, name: 'Kadapa',        state: 'Andhra Pradesh' },
  anantapur:     { latitude: 14.6819, longitude: 77.6006, name: 'Anantapur',     state: 'Andhra Pradesh' },
  // ── Telangana ─────────────────────────────────────────────────────────────
  hyderabad:     { latitude: 17.3850, longitude: 78.4867, name: 'Hyderabad',     state: 'Telangana' },
  warangal:      { latitude: 17.9689, longitude: 79.5941, name: 'Warangal',      state: 'Telangana' },
  nizamabad:     { latitude: 18.6725, longitude: 78.0941, name: 'Nizamabad',     state: 'Telangana' },
  karimnagar:    { latitude: 18.4386, longitude: 79.1288, name: 'Karimnagar',    state: 'Telangana' },
  khammam:       { latitude: 17.2473, longitude: 80.1514, name: 'Khammam',       state: 'Telangana' },
  nalgonda:      { latitude: 17.0575, longitude: 79.2670, name: 'Nalgonda',      state: 'Telangana' },
  mahabubnagar:  { latitude: 16.7488, longitude: 77.9866, name: 'Mahabubnagar',  state: 'Telangana' },
  medak:         { latitude: 18.0471, longitude: 78.2615, name: 'Medak',         state: 'Telangana' },
  // ── Odisha ────────────────────────────────────────────────────────────────
  bhubaneswar:   { latitude: 20.2961, longitude: 85.8245, name: 'Bhubaneswar',   state: 'Odisha' },
  cuttack:       { latitude: 20.4625, longitude: 85.8830, name: 'Cuttack',       state: 'Odisha' },
  sambalpur:     { latitude: 21.4669, longitude: 83.9756, name: 'Sambalpur',     state: 'Odisha' },
  berhampur:     { latitude: 19.3149, longitude: 84.7941, name: 'Berhampur',     state: 'Odisha' },
  rourkela:      { latitude: 22.2604, longitude: 84.8536, name: 'Rourkela',      state: 'Odisha' },
  balasore:      { latitude: 21.4942, longitude: 86.9335, name: 'Balasore',      state: 'Odisha' },
  // ── Chhattisgarh ──────────────────────────────────────────────────────────
  raipur:        { latitude: 21.2514, longitude: 81.6296, name: 'Raipur',        state: 'Chhattisgarh' },
  bilaspur:      { latitude: 22.0796, longitude: 82.1391, name: 'Bilaspur',      state: 'Chhattisgarh' },
  durg:          { latitude: 21.1904, longitude: 81.2849, name: 'Durg',          state: 'Chhattisgarh' },
  rajnandgaon:   { latitude: 21.0969, longitude: 81.0289, name: 'Rajnandgaon',   state: 'Chhattisgarh' },
  korba:         { latitude: 22.3595, longitude: 82.7501, name: 'Korba',         state: 'Chhattisgarh' },
  // ── Jharkhand ─────────────────────────────────────────────────────────────
  ranchi:        { latitude: 23.3441, longitude: 85.3096, name: 'Ranchi',        state: 'Jharkhand' },
  dhanbad:       { latitude: 23.7957, longitude: 86.4304, name: 'Dhanbad',       state: 'Jharkhand' },
  jamshedpur:    { latitude: 22.8046, longitude: 86.2029, name: 'Jamshedpur',    state: 'Jharkhand' },
  bokaro:        { latitude: 23.6693, longitude: 86.1511, name: 'Bokaro',        state: 'Jharkhand' },
  // ── Delhi ─────────────────────────────────────────────────────────────────
  delhi:         { latitude: 28.6139, longitude: 77.2090, name: 'Delhi',         state: 'Delhi' },
  'new delhi':   { latitude: 28.6139, longitude: 77.2090, name: 'New Delhi',     state: 'Delhi' },
  // ── Uttarakhand ───────────────────────────────────────────────────────────
  dehradun:      { latitude: 30.3165, longitude: 78.0322, name: 'Dehradun',      state: 'Uttarakhand' },
  haridwar:      { latitude: 29.9457, longitude: 78.1642, name: 'Haridwar',      state: 'Uttarakhand' },
  roorkee:       { latitude: 29.8543, longitude: 77.8880, name: 'Roorkee',       state: 'Uttarakhand' },
  nainital:      { latitude: 29.3803, longitude: 79.4636, name: 'Nainital',      state: 'Uttarakhand' },
  udham_singh_nagar: { latitude: 28.9667, longitude: 79.5167, name: 'Udham Singh Nagar', state: 'Uttarakhand' },
  // ── Himachal Pradesh ──────────────────────────────────────────────────────
  shimla:        { latitude: 31.1048, longitude: 77.1734, name: 'Shimla',        state: 'Himachal Pradesh' },
  mandi:         { latitude: 31.7083, longitude: 76.9318, name: 'Mandi',         state: 'Himachal Pradesh' },
  kangra:        { latitude: 32.0998, longitude: 76.2691, name: 'Kangra',        state: 'Himachal Pradesh' },
  kullu:         { latitude: 31.9579, longitude: 77.1097, name: 'Kullu',         state: 'Himachal Pradesh' },
  solan:         { latitude: 30.9045, longitude: 77.0967, name: 'Solan',         state: 'Himachal Pradesh' },
  // ── Assam ─────────────────────────────────────────────────────────────────
  guwahati:      { latitude: 26.1445, longitude: 91.7362, name: 'Guwahati',      state: 'Assam' },
  dibrugarh:     { latitude: 27.4728, longitude: 94.9120, name: 'Dibrugarh',     state: 'Assam' },
  jorhat:        { latitude: 26.7465, longitude: 94.2026, name: 'Jorhat',        state: 'Assam' },
  silchar:       { latitude: 24.8333, longitude: 92.7789, name: 'Silchar',       state: 'Assam' },
  nagaon:        { latitude: 26.3467, longitude: 92.6853, name: 'Nagaon',        state: 'Assam' },
  // ── Kerala ────────────────────────────────────────────────────────────────
  thiruvananthapuram: { latitude: 8.5241, longitude: 76.9366, name: 'Thiruvananthapuram', state: 'Kerala' },
  trivandrum:    { latitude: 8.5241,  longitude: 76.9366, name: 'Thiruvananthapuram', state: 'Kerala' },
  kochi:         { latitude: 9.9312,  longitude: 76.2673, name: 'Kochi',         state: 'Kerala' },
  kozhikode:     { latitude: 11.2588, longitude: 75.7804, name: 'Kozhikode',     state: 'Kerala' },
  thrissur:      { latitude: 10.5276, longitude: 76.2144, name: 'Thrissur',      state: 'Kerala' },
  palakkad:      { latitude: 10.7867, longitude: 76.6548, name: 'Palakkad',      state: 'Kerala' },
  kollam:        { latitude: 8.8932,  longitude: 76.6141, name: 'Kollam',        state: 'Kerala' },
  kannur:        { latitude: 11.8745, longitude: 75.3704, name: 'Kannur',        state: 'Kerala' },
  malappuram:    { latitude: 11.0510, longitude: 76.0711, name: 'Malappuram',    state: 'Kerala' },
  idukki:        { latitude: 9.9189,  longitude: 76.9720, name: 'Idukki',        state: 'Kerala' },
}

// ── WMO Weather Interpretation Code → human-readable condition ───────────────

/**
 * Map Open-Meteo WMO weather interpretation codes to human-readable strings.
 * https://open-meteo.com/en/docs#weathervariables
 *
 * @param {number|null} code
 * @returns {string}
 */
function wmoCodeToCondition(code) {
  if (code === null || code === undefined) return 'Unknown'
  if (code === 0) return 'Clear Sky'
  if (code <= 2) return 'Partly Cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 49) return 'Foggy'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 84) return 'Snow Showers'
  if (code <= 99) return 'Thunderstorm'
  return 'Unknown'
}

// ── HTTP fetch helper with timeout ──────────────────────────────────────────

/**
 * Fetch a URL with a configurable timeout.
 * Uses the native Node fetch (Node 18+) with AbortController.
 *
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        // Identify the application without spoofing a browser — some CDN edges
        // block headless Node requests that look like bots.  A realistic UA
        // helps on Render's outbound NAT IPs which may be flagged.
        'User-Agent': 'AgroGenieAI/1.0 (weather-provider; +https://agrogenie.ai)',
      },
    })
    clearTimeout(timer)
    return response
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

// ── Error mapping ─────────────────────────────────────────────────────────

/**
 * Map a fetch/HTTP error to a typed application-level error.
 * Never exposes raw response bodies or internal SDK objects.
 *
 * @param {Error|object} err
 * @returns {Error}
 */
function mapWeatherError(err) {
  const appErr = new Error()
  const msg = err.message ?? ''
  const status = err._httpStatus ?? 0

  if (msg.includes('abort') || msg.toLowerCase().includes('timeout')) {
    appErr.code = 'WEATHER_TIMEOUT'
    appErr.statusCode = 504
    appErr.message = 'Weather provider request timed out. Please try again.'
    return appErr
  }
  if (status === 401 || status === 403) {
    appErr.code = 'WEATHER_AUTH_ERROR'
    appErr.statusCode = 502
    appErr.message = 'Weather provider authentication error.'
    return appErr
  }
  if (status === 404) {
    appErr.code = 'WEATHER_LOCATION_NOT_FOUND'
    appErr.statusCode = 404
    appErr.message = 'Weather data not found for the specified location.'
    return appErr
  }
  if (status === 429) {
    appErr.code = 'WEATHER_RATE_LIMIT'
    appErr.statusCode = 429
    appErr.message = 'Weather provider rate limit reached. Please wait and try again.'
    return appErr
  }
  if (status >= 500) {
    appErr.code = 'WEATHER_PROVIDER_UNAVAILABLE'
    appErr.statusCode = 502
    appErr.message = 'Weather provider is temporarily unavailable.'
    return appErr
  }
  if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('network')) {
    appErr.code = 'WEATHER_PROVIDER_UNAVAILABLE'
    appErr.statusCode = 502
    appErr.message = 'Cannot reach weather provider. Check your internet connection.'
    return appErr
  }

  appErr.code = 'WEATHER_PROVIDER_UNAVAILABLE'
  appErr.statusCode = 502
  appErr.message = 'An unexpected error occurred while fetching weather data.'
  return appErr
}

// ── Open-Meteo API helpers ────────────────────────────────────────────────

/**
 * Fetch current weather and daily forecast from Open-Meteo.
 *
 * Open-Meteo documentation: https://open-meteo.com/en/docs
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} days
 * @returns {Promise<object>} Raw Open-Meteo JSON response
 */
async function fetchOpenMeteo(latitude, longitude, days) {
  const { apiUrl, requestTimeoutMs } = config.weather

  const currentVars = [
    'temperature_2m',
    'apparent_temperature',
    'relative_humidity_2m',
    'precipitation',
    'wind_speed_10m',
    'weather_code',
  ].join(',')

  const dailyVars = [
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_sum',
    'precipitation_probability_max',
    'wind_speed_10m_max',
    'relative_humidity_2m_max',
    'weather_code',
  ].join(',')

  const url =
    `${apiUrl}/forecast` +
    `?latitude=${latitude}` +
    `&longitude=${longitude}` +
    `&current=${currentVars}` +
    `&daily=${dailyVars}` +
    `&forecast_days=${days}` +
    `&wind_speed_unit=kmh` +
    `&timezone=Asia%2FKolkata`

  logger.debug('WeatherProvider: fetching Open-Meteo forecast', { latitude, longitude, forecastDays: days })

  let response
  try {
    response = await fetchWithTimeout(url, requestTimeoutMs)
  } catch (err) {
    throw mapWeatherError(err)
  }

  if (!response.ok) {
    const httpErr = new Error(`Open-Meteo HTTP ${response.status}`)
    httpErr._httpStatus = response.status
    throw mapWeatherError(httpErr)
  }

  let json
  try {
    json = await response.json()
  } catch {
    const parseErr = new Error('Failed to parse weather provider response')
    parseErr.code = 'WEATHER_RESPONSE_ERROR'
    parseErr.statusCode = 502
    throw parseErr
  }

  return json
}

// ── District lookup (step 1 of coordinate resolution) ────────────────────────

/**
 * Look up a district name in the DISTRICT_COORDS table.
 *
 * The lookup is case-insensitive and strips leading/trailing whitespace.
 * Returns null when the district is unknown (caller should try geocoding).
 *
 * @param {string|null|undefined} district
 * @returns {{ latitude, longitude, name, state }|null}
 */
function lookupDistrictCoords(district) {
  if (!district || typeof district !== 'string') return null
  const key = district.trim().toLowerCase()
  return DISTRICT_COORDS[key] ?? null
}

// ── Open-Meteo Geocoding (step 2 of coordinate resolution) ───────────────────

/**
 * Geocode a single city/district name using Open-Meteo Geocoding API.
 *
 * KEY FIX: the `name` parameter must contain ONLY the city/district name —
 * NOT a compound string like "Karnal, Haryana, India".  Open-Meteo geocoding
 * is a prefix search on the city name field; commas and country qualifiers
 * cause zero matches.
 *
 * @param {string} cityName - Single city or district name (no commas)
 * @returns {Promise<{ latitude, longitude, name, admin1, country }|null>}
 */
async function geocodeLocation(cityName) {
  const { geocodingUrl, requestTimeoutMs } = config.weather

  // Sanitize: keep only the first comma-delimited token so callers cannot
  // accidentally pass a compound string through to this function.
  const cleanName = cityName.trim().split(',')[0].trim()
  if (!cleanName) return null

  // Use encodeURIComponent on the clean name only — no commas, no spaces
  // that would be encoded as %2C or %20 before the actual name content.
  const url =
    `${geocodingUrl}/search` +
    `?name=${encodeURIComponent(cleanName)}` +
    `&count=10` +
    `&language=en` +
    `&format=json`

  logger.info('WeatherProvider: geocoding request', { cityName: cleanName, url })

  let response
  try {
    response = await fetchWithTimeout(url, requestTimeoutMs)
  } catch (err) {
    logger.error('WeatherProvider: geocoding fetch failed', { cityName: cleanName, error: err.message })
    return null
  }

  if (!response.ok) {
    logger.error('WeatherProvider: geocoding HTTP error', { status: response.status, cityName: cleanName })
    return null
  }

  let json
  try {
    const rawText = await response.text()
    logger.info('WeatherProvider: geocoding raw response', { body: rawText })
    json = JSON.parse(rawText)
  } catch (err) {
    logger.error('WeatherProvider: geocoding JSON parse error', { error: err.message })
    return null
  }

  if (!Array.isArray(json.results) || json.results.length === 0) {
    logger.warn('WeatherProvider: geocoding returned no results', { cityName: cleanName })
    return null
  }

  // Prefer an India result; fall back to the first entry.
  const indiaResult =
    json.results.find(r => r.country_code === 'IN' || r.country === 'India') ??
    json.results[0]

  logger.info('WeatherProvider: geocoding selected result', {
    name: indiaResult.name,
    state: indiaResult.admin1,
    country: indiaResult.country,
    latitude: indiaResult.latitude,
    longitude: indiaResult.longitude,
  })

  return {
    latitude: indiaResult.latitude,
    longitude: indiaResult.longitude,
    name: indiaResult.name,
    admin1: indiaResult.admin1 ?? null,
    country: indiaResult.country ?? null,
  }
}

// ── Coordinate resolution (lookup → geocode district → geocode state) ─────────

/**
 * Resolve geographic coordinates for a district/state pair using a
 * three-tier strategy:
 *
 *   Tier 1 — DISTRICT_COORDS table (instant, no network)
 *   Tier 2 — Open-Meteo geocoding of district name only
 *   Tier 3 — Open-Meteo geocoding of state name only (regional fallback)
 *
 * Returns null only if all three tiers fail.
 *
 * @param {string|null} district
 * @param {string|null} state
 * @returns {Promise<{ latitude, longitude, name, admin1 }|null>}
 */
async function resolveCoordinates(district, state) {
  // ── Tier 1: local lookup table ─────────────────────────────────────────
  if (district) {
    const tableResult = lookupDistrictCoords(district)
    if (tableResult) {
      logger.info('WeatherProvider: coordinates resolved from district table', {
        district,
        latitude: tableResult.latitude,
        longitude: tableResult.longitude,
      })
      return {
        latitude: tableResult.latitude,
        longitude: tableResult.longitude,
        name: tableResult.name,
        admin1: tableResult.state,
      }
    }
  }

  // ── Tier 2: geocode district name only ─────────────────────────────────
  if (district) {
    const geoResult = await geocodeLocation(district)
    if (geoResult) {
      logger.info('WeatherProvider: coordinates resolved by geocoding district', {
        district,
        latitude: geoResult.latitude,
        longitude: geoResult.longitude,
      })
      return geoResult
    }
    logger.warn('WeatherProvider: geocoding returned nothing for district', { district })
  }

  // ── Tier 3: geocode state name (regional fallback) ─────────────────────
  if (state) {
    logger.info('WeatherProvider: falling back to state-level geocoding', { state })
    const stateResult = await geocodeLocation(state)
    if (stateResult) {
      logger.info('WeatherProvider: coordinates resolved by geocoding state', {
        state,
        latitude: stateResult.latitude,
        longitude: stateResult.longitude,
      })
      return stateResult
    }
    logger.warn('WeatherProvider: geocoding returned nothing for state', { state })
  }

  return null
}

// ── Response normalization ────────────────────────────────────────────────

/**
 * Normalize an Open-Meteo API response to the provider-neutral weather shape.
 *
 * @param {object} raw - Raw Open-Meteo response
 * @param {object} locationMeta - Location metadata (name, district, state, lat, lon)
 * @returns {object} Normalized weather data
 */
function normalizeOpenMeteoResponse(raw, locationMeta) {
  const cur = raw.current ?? {}
  const daily = raw.daily ?? {}

  // ── Current weather ───────────────────────────────────────────────────
  const current = {
    observedAt: cur.time ? new Date(cur.time).toISOString() : new Date().toISOString(),
    temperatureC: cur.temperature_2m ?? null,
    feelsLikeC: cur.apparent_temperature ?? null,
    humidityPercent: cur.relative_humidity_2m ?? null,
    windSpeedKph: cur.wind_speed_10m ?? null,
    precipitationMm: cur.precipitation ?? null,
    condition: wmoCodeToCondition(cur.weather_code),
  }

  // ── Daily forecast ────────────────────────────────────────────────────
  const dates = daily.time ?? []
  const forecast = dates.map((date, i) => ({
    date,
    minTemperatureC: daily.temperature_2m_min?.[i] ?? null,
    maxTemperatureC: daily.temperature_2m_max?.[i] ?? null,
    precipitationProbabilityPercent: daily.precipitation_probability_max?.[i] ?? null,
    precipitationMm: daily.precipitation_sum?.[i] ?? null,
    humidityPercent: daily.relative_humidity_2m_max?.[i] ?? null,
    windSpeedKph: daily.wind_speed_10m_max?.[i] ?? null,
    condition: wmoCodeToCondition(daily.weather_code?.[i]),
  }))

  return {
    location: {
      name: locationMeta.name,
      district: locationMeta.district ?? null,
      state: locationMeta.state ?? null,
      latitude: locationMeta.latitude ?? raw.latitude ?? null,
      longitude: locationMeta.longitude ?? raw.longitude ?? null,
    },
    current,
    forecast,
    metadata: {
      provider: 'open-meteo',
      fetchedAt: new Date().toISOString(),
      isDemo: false,
    },
  }
}

// ── Provider export ──────────────────────────────────────────────────────────

export const realWeatherProvider = {
  /**
   * Get current weather and forecast for a known coordinate pair.
   *
   * @param {object} params
   * @param {number} params.latitude
   * @param {number} params.longitude
   * @param {string} [params.locationName]
   * @returns {Promise<object>} Normalized weather data
   */
  async getCurrentWeather({ latitude, longitude, locationName } = {}) {
    const { forecastDays } = config.weather
    const raw = await fetchOpenMeteo(latitude, longitude, forecastDays)
    return normalizeOpenMeteoResponse(raw, {
      name: locationName ?? `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
      district: null,
      state: null,
      latitude,
      longitude,
    })
  },

  /**
   * Get multi-day forecast for a coordinate location.
   *
   * @param {object} params
   * @param {number} params.latitude
   * @param {number} params.longitude
   * @param {string} [params.locationName]
   * @param {number} [params.days]
   * @returns {Promise<object>} Normalized weather data with forecast
   */
  async getForecast({ latitude, longitude, locationName, days } = {}) {
    const requestDays = days ?? config.weather.forecastDays
    const raw = await fetchOpenMeteo(latitude, longitude, requestDays)
    return normalizeOpenMeteoResponse(raw, {
      name: locationName ?? `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
      district: null,
      state: null,
      latitude,
      longitude,
    })
  },

  /**
   * Get weather by Indian district or state name.
   *
   * Coordinate resolution order:
   *   1. DISTRICT_COORDS table — instant, no network, covers ~260 districts
   *   2. Open-Meteo geocoding of district name only (NOT compound string)
   *   3. Open-Meteo geocoding of state name (regional fallback)
   *
   * @param {object} params
   * @param {string} [params.state]
   * @param {string} [params.district]
   * @param {number} [params.days]
   * @returns {Promise<object>} Normalized weather data
   */
  async getWeatherByLocation({ state, district, days } = {}) {
    const requestDays = days ?? config.weather.forecastDays

    if (!district && !state) {
      const err = new Error('No location provided for weather lookup.')
      err.code = 'WEATHER_LOCATION_NOT_FOUND'
      err.statusCode = 404
      throw err
    }

    logger.info('WeatherProvider: resolving coordinates', { district, state })

    const geo = await resolveCoordinates(district, state)

    if (!geo) {
      const label = district ? `${district}${state ? ', ' + state : ''}` : state
      logger.error('WeatherProvider: all coordinate resolution tiers failed', { district, state })
      const err = new Error(`Could not find geographic coordinates for "${label}".`)
      err.code = 'WEATHER_LOCATION_NOT_FOUND'
      err.statusCode = 404
      throw err
    }

    logger.debug('WeatherProvider: coordinates resolved', {
      district,
      state,
      latitude: geo.latitude,
      longitude: geo.longitude,
    })

    const raw = await fetchOpenMeteo(geo.latitude, geo.longitude, requestDays)

    const locationName = district
      ? `${district}${state ? ', ' + state : ''}`
      : geo.name ?? state

    return normalizeOpenMeteoResponse(raw, {
      name: locationName,
      district: district ?? null,
      state: state ?? geo.admin1 ?? null,
      latitude: geo.latitude,
      longitude: geo.longitude,
    })
  },

  /**
   * Readiness check — validates configuration without a live API call.
   *
   * @returns {Promise<{ready: boolean, provider: string, isDemo: boolean}>}
   */
  async checkReadiness() {
    const { apiUrl } = config.weather
    if (!apiUrl) {
      return { ready: false, provider: 'open-meteo', isDemo: false, reason: 'WEATHER_API_URL not configured' }
    }
    return { ready: true, provider: 'open-meteo', isDemo: false }
  },
}
