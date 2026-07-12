// Mock government scheme data
export const mockSchemes = [
  {
    id: 'sc1',
    name: 'PM Kisan Samman Nidhi',
    authority: 'Ministry of Agriculture & Farmers Welfare, GoI',
    category: 'Credit',
    purpose: 'Direct income support of ₹6,000 per year to small and marginal farmers in three equal installments.',
    relevance: 'high',
    relevanceLabel: 'Likely Relevant',
    eligibility: [
      'Small and marginal farmers with cultivable land up to 2 hectares',
      'Must be a resident of India',
      'Bank account linked with Aadhaar required'
    ],
    benefits: 'Financial benefit of ₹6,000/year in three installments of ₹2,000 each.',
    documents: ['Aadhaar Card', 'Land records (7/12 extract)', 'Bank passbook', 'Passport-size photo'],
    applyUrl: 'https://pmkisan.gov.in',
    sourceDoc: 'PM-KISAN Operational Guidelines 2023',
    sourceDate: 'April 2023',
    isDemo: true
  },
  {
    id: 'sc2',
    name: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
    authority: 'Ministry of Agriculture & Farmers Welfare, GoI',
    category: 'Crop Insurance',
    purpose: 'Comprehensive crop insurance to provide financial support to farmers in case of crop failure due to natural calamities, pests, or disease.',
    relevance: 'high',
    relevanceLabel: 'Likely Relevant',
    eligibility: [
      'All farmers including sharecroppers and tenant farmers growing notified crops',
      'Enrollment during kharif or rabi season via banks or Common Service Centres',
      'Aadhaar mandatory for enrollment'
    ],
    benefits: 'Up to full sum insured for crop losses. Premium as low as 1.5–2% for rabi crops.',
    documents: ['Aadhaar Card', 'Land/lease records', 'Bank account details', 'Sowing certificate'],
    applyUrl: 'https://pmfby.gov.in',
    sourceDoc: 'PMFBY Operational Guidelines 2023-24',
    sourceDate: 'June 2023',
    isDemo: true
  },
  {
    id: 'sc3',
    name: 'PM Krishi Sinchayee Yojana — Drip/Sprinkler',
    authority: 'Ministry of Agriculture & Farmers Welfare / NABARD',
    category: 'Irrigation',
    purpose: 'Subsidy for micro-irrigation (drip and sprinkler systems) to promote water use efficiency.',
    relevance: 'medium',
    relevanceLabel: 'May Be Relevant',
    eligibility: [
      'Farmers who do not already have drip/sprinkler irrigation installed',
      'Small/marginal farmers: up to 55% subsidy; others: up to 45%',
      'State-specific targets and crop priorities apply'
    ],
    benefits: 'Subsidy of 45–55% on installation of drip/sprinkler irrigation systems.',
    documents: ['Aadhaar', 'Land records', 'Bank account', 'Quotation from approved vendor'],
    applyUrl: 'https://pmksy.gov.in',
    sourceDoc: 'PMKSY-PDMC Implementation Guidelines',
    sourceDate: 'March 2023',
    isDemo: true
  },
  {
    id: 'sc4',
    name: 'Kisan Credit Card (KCC)',
    authority: 'NABARD / Participating Banks',
    category: 'Credit',
    purpose: 'Short-term credit for agricultural operations at concessional interest rates.',
    relevance: 'medium',
    relevanceLabel: 'May Be Relevant',
    eligibility: [
      'Farmers engaged in crop cultivation, horticulture, or animal husbandry',
      'Credit limit up to ₹3 lakh at 7% interest (effective 4% with interest subvention)',
      'Must have land records or lease agreement'
    ],
    benefits: 'Revolving credit up to ₹3 lakh at 7% p.a. (4% effective with subvention).',
    documents: ['Identity proof', 'Land records', 'Passport-size photo', 'Existing loan details if any'],
    applyUrl: 'https://nabard.org/kcc',
    sourceDoc: 'KCC Revised Scheme 2019, RBI Circular',
    sourceDate: 'August 2019',
    isDemo: true
  },
  {
    id: 'sc5',
    name: 'Soil Health Card Scheme',
    authority: 'Ministry of Agriculture & Farmers Welfare, GoI',
    category: 'Soil Health',
    purpose: 'Provides farmers with soil health cards indicating nutrient status and fertilizer recommendations.',
    relevance: 'medium',
    relevanceLabel: 'May Be Relevant',
    eligibility: [
      'All farmers in India are eligible',
      'Soil samples collected by state agriculture departments at block/district level'
    ],
    benefits: 'Free soil testing and printed health card with crop-specific fertilizer recommendations.',
    documents: ['Aadhaar / any identity proof', 'Land details'],
    applyUrl: 'https://soilhealth.dac.gov.in',
    sourceDoc: 'SHC Scheme Guidelines 2015 (Revised 2022)',
    sourceDate: 'January 2022',
    isDemo: true
  },
  {
    id: 'sc6',
    name: 'Agricultural Infrastructure Fund (AIF)',
    authority: 'Ministry of Agriculture & Farmers Welfare / Participating Banks',
    category: 'Equipment',
    purpose: 'Provides medium to long-term debt financing for investment in post-harvest management and agriculture infrastructure.',
    relevance: 'low',
    relevanceLabel: 'Potentially Relevant',
    eligibility: [
      'Farmers, FPOs, PACS, cooperatives, agri-entrepreneurs',
      'For projects like warehouses, cold storage, pack houses, primary processing',
      'Loan up to ₹2 crore with 3% interest subvention'
    ],
    benefits: 'Interest subvention of 3% per annum for up to 7 years on loans up to ₹2 crore.',
    documents: ['Identity proof', 'Project report', 'Land/lease records', 'Bank statements'],
    applyUrl: 'https://agriinfra.dac.gov.in',
    sourceDoc: 'AIF Scheme Guidelines 2020',
    sourceDate: 'July 2020',
    isDemo: true
  }
]

export const mockSchemeCategories = ['All', 'Irrigation', 'Crop Insurance', 'Equipment', 'Credit', 'Soil Health', 'Training']
