/**
 * Government scheme seed — Phase 12.
 *
 * Transforms the existing data/mock/schemes.js records into full Scheme model
 * records and inserts them into MongoDB (or the in-memory store if no DB).
 *
 * IMPORTANT DATA INTEGRITY RULES:
 *   - All seeded records carry isDemo: true.
 *   - Benefit amounts, document lists, and URLs come only from the existing
 *     verified mock data — nothing is invented here.
 *   - Eligibility rules are machine-readable translations of the text
 *     conditions that already exist in the mock data.
 *   - lastVerifiedAt reflects the sourceDate recorded in the original mock data,
 *     NOT the current date.
 *   - No record claims ACTIVE status unless the original data confirms it.
 *     We use 'ACTIVE' for these known running central schemes, but every
 *     record carries isDemo: true and a verification warning until individually
 *     re-confirmed against the official portal.
 *
 * Usage:
 *   node server/src/data/seed/schemes.seed.js
 *
 * The seed is idempotent — it skips records whose schemeCode already exists.
 */
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

// Bootstrap env before any config import
import 'dotenv/config'

import { createSchemeRecord } from '../../models/scheme.schema.js'
import {
  createScheme,
  findByCode,
} from '../../repositories/scheme.repository.js'
import { connect as connectDb } from '../../services/db.service.js'
import logger from '../../utils/logger.js'

// ── Seed definitions ──────────────────────────────────────────────────────────
// These are derived from data/mock/schemes.js.
// Only fields that exist in the verified mock source are used.
// Eligibility rules are machine-readable translations of the text conditions.
// ─────────────────────────────────────────────────────────────────────────────

const SEED_SCHEMES = [
  {
    schemeCode: 'PM-KISAN',
    name: 'PM Kisan Samman Nidhi',
    shortName: 'PM-KISAN',
    description:
      'Direct income support of ₹6,000 per year to small and marginal farmers in three equal installments of ₹2,000 each.',
    schemeLevel: 'CENTRAL',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    department: 'Department of Agriculture & Farmers Welfare',
    applicableStates: [], // Nationwide — empty means all states
    applicableDistricts: [],
    targetBeneficiaries: ['Small and marginal farmers'],
    categories: ['income support', 'credit', 'financial assistance'],
    benefitsSummary:
      'Financial benefit of ₹6,000/year in three installments of ₹2,000 each, transferred directly to the farmer\'s bank account.',
    officialSourceUrl: 'https://pmkisan.gov.in',
    applicationUrl: 'https://pmkisan.gov.in',
    applicationMode: 'BOTH',
    validFrom: null,
    validUntil: null,
    status: 'ACTIVE',
    lastVerifiedAt: '2023-04-01T00:00:00.000Z',
    verificationNotes: 'Seeded from PM-KISAN Operational Guidelines 2023. Verify at pmkisan.gov.in for current status.',
    sourceDocumentIds: [],
    eligibilityRules: [
      {
        field: 'farm.area',
        operator: 'LESS_THAN_OR_EQUAL',
        value: 2,
        required: true,
        explanation: 'Farm area must be at most 2 hectares (small and marginal landholding).',
      },
    ],
    requiredDocuments: [
      { name: 'Aadhaar Card', requiredStatus: 'required', condition: null },
      { name: 'Land records (7/12 extract)', requiredStatus: 'required', condition: null },
      { name: 'Bank passbook', requiredStatus: 'required', condition: null },
      { name: 'Passport-size photograph', requiredStatus: 'required', condition: null },
    ],
    applicationSteps: [
      { order: 1, description: 'Visit pmkisan.gov.in or nearest Common Service Centre (CSC).' },
      { order: 2, description: 'Submit Aadhaar card, land records, and bank account details.' },
      { order: 3, description: 'State government verifies eligibility.' },
      { order: 4, description: 'Funds transferred directly to bank account in installments.' },
    ],
    tags: ['pm-kisan', 'income support', 'small farmer', 'marginal farmer', 'cash transfer'],
    isDemo: true,
  },
  {
    schemeCode: 'PMFBY',
    name: 'Pradhan Mantri Fasal Bima Yojana',
    shortName: 'PMFBY',
    description:
      'Comprehensive crop insurance providing financial support to farmers in case of crop failure due to natural calamities, pests, or disease.',
    schemeLevel: 'CENTRAL',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    department: 'Department of Agriculture & Farmers Welfare',
    applicableStates: [],
    applicableDistricts: [],
    targetBeneficiaries: ['Farmers growing notified crops', 'Sharecroppers', 'Tenant farmers'],
    categories: ['crop insurance', 'risk management', 'financial assistance'],
    benefitsSummary:
      'Up to full sum insured for crop losses. Premium as low as 1.5% for rabi and 2% for kharif crops (remainder paid by government).',
    officialSourceUrl: 'https://pmfby.gov.in',
    applicationUrl: 'https://pmfby.gov.in',
    applicationMode: 'BOTH',
    validFrom: null,
    validUntil: null,
    status: 'ACTIVE',
    lastVerifiedAt: '2023-06-01T00:00:00.000Z',
    verificationNotes: 'Seeded from PMFBY Operational Guidelines 2023-24. Verify at pmfby.gov.in for current notified crops and deadlines.',
    sourceDocumentIds: [],
    eligibilityRules: [
      {
        field: 'cropContext.currentCrop',
        operator: 'EXISTS',
        value: null,
        required: true,
        explanation: 'A notified crop must be under cultivation. Specific notified crops vary by state and season.',
      },
    ],
    requiredDocuments: [
      { name: 'Aadhaar Card', requiredStatus: 'required', condition: null },
      { name: 'Land or lease records', requiredStatus: 'required', condition: null },
      { name: 'Bank account details', requiredStatus: 'required', condition: null },
      { name: 'Sowing certificate', requiredStatus: 'required', condition: null },
    ],
    applicationSteps: [
      { order: 1, description: 'Contact nearest bank or Common Service Centre before the enrollment deadline for the season.' },
      { order: 2, description: 'Submit Aadhaar card, land records, and sowing certificate.' },
      { order: 3, description: 'Premium is deducted from your bank account.' },
      { order: 4, description: 'In case of crop loss, file a claim via the bank within 72 hours of the calamity.' },
    ],
    tags: ['pmfby', 'crop insurance', 'kharif', 'rabi', 'natural calamity', 'sharecropper', 'tenant'],
    isDemo: true,
  },
  {
    schemeCode: 'PMKSY-PDMC',
    name: 'PM Krishi Sinchayee Yojana — Drip/Sprinkler',
    shortName: 'PMKSY-PDMC',
    description:
      'Subsidy for micro-irrigation (drip and sprinkler systems) under the Per Drop More Crop component to promote water use efficiency.',
    schemeLevel: 'CENTRAL',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    department: 'Department of Agriculture & Farmers Welfare / NABARD',
    applicableStates: [],
    applicableDistricts: [],
    targetBeneficiaries: ['Farmers seeking micro-irrigation installation'],
    categories: ['irrigation', 'subsidy', 'water efficiency', 'infrastructure'],
    benefitsSummary:
      'Subsidy of 45% for general category farmers and 55% for small/marginal farmers on installation of drip or sprinkler irrigation systems.',
    officialSourceUrl: 'https://pmksy.gov.in',
    applicationUrl: 'https://pmksy.gov.in',
    applicationMode: 'BOTH',
    validFrom: null,
    validUntil: null,
    status: 'ACTIVE',
    lastVerifiedAt: '2023-03-01T00:00:00.000Z',
    verificationNotes: 'Seeded from PMKSY-PDMC Implementation Guidelines. State-specific targets and crop priorities apply. Verify at pmksy.gov.in.',
    sourceDocumentIds: [],
    eligibilityRules: [
      {
        field: 'farm.irrigationType',
        operator: 'NOT_IN',
        value: ['drip', 'sprinkler', 'Drip', 'Sprinkler'],
        required: false,
        explanation: 'Farmers who do not already have drip or sprinkler irrigation installed may be eligible. State-specific rules apply.',
      },
    ],
    requiredDocuments: [
      { name: 'Aadhaar Card', requiredStatus: 'required', condition: null },
      { name: 'Land records', requiredStatus: 'required', condition: null },
      { name: 'Bank account details', requiredStatus: 'required', condition: null },
      { name: 'Quotation from approved vendor', requiredStatus: 'required', condition: null },
    ],
    applicationSteps: [
      { order: 1, description: 'Apply through your state agriculture department or the NABARD portal.' },
      { order: 2, description: 'Submit land records and a quotation from an approved irrigation vendor.' },
      { order: 3, description: 'Physical verification of the farm will be conducted.' },
      { order: 4, description: 'Subsidy is credited to your bank account after installation is confirmed.' },
    ],
    tags: ['pmksy', 'irrigation', 'drip irrigation', 'sprinkler', 'water efficiency', 'micro irrigation', 'subsidy'],
    isDemo: true,
  },
  {
    schemeCode: 'KCC',
    name: 'Kisan Credit Card',
    shortName: 'KCC',
    description:
      'Short-term credit facility for agricultural operations at concessional interest rates, issued through banks and cooperative societies.',
    schemeLevel: 'CENTRAL',
    ministry: 'Ministry of Finance / NABARD',
    department: 'NABARD / Participating Banks',
    applicableStates: [],
    applicableDistricts: [],
    targetBeneficiaries: ['Farmers engaged in crop cultivation', 'Horticulture farmers', 'Animal husbandry farmers'],
    categories: ['credit', 'working capital', 'financial assistance'],
    benefitsSummary:
      'Revolving credit up to ₹3 lakh at 7% per annum interest (effective 4% with government interest subvention).',
    officialSourceUrl: 'https://nabard.org/kcc',
    applicationUrl: 'https://nabard.org/kcc',
    applicationMode: 'OFFLINE',
    validFrom: null,
    validUntil: null,
    status: 'ACTIVE',
    lastVerifiedAt: '2019-08-01T00:00:00.000Z',
    verificationNotes: 'Seeded from KCC Revised Scheme 2019 and RBI Circular. Verify current interest rates with your bank.',
    sourceDocumentIds: [],
    eligibilityRules: [
      {
        field: 'cropContext.currentCrop',
        operator: 'EXISTS',
        value: null,
        required: false,
        explanation: 'Applicant must be engaged in crop cultivation, horticulture, or animal husbandry.',
      },
    ],
    requiredDocuments: [
      { name: 'Identity proof', requiredStatus: 'required', condition: null },
      { name: 'Land records or lease agreement', requiredStatus: 'required', condition: null },
      { name: 'Passport-size photograph', requiredStatus: 'required', condition: null },
      { name: 'Details of existing loans, if any', requiredStatus: 'conditional', condition: 'If existing loans are present' },
    ],
    applicationSteps: [
      { order: 1, description: 'Visit the nearest bank branch, regional rural bank, or cooperative society.' },
      { order: 2, description: 'Submit land records and identity proof.' },
      { order: 3, description: 'Bank verifies the application and processes it.' },
      { order: 4, description: 'KCC is issued with a credit limit based on your land holding and crop requirement.' },
    ],
    tags: ['kcc', 'kisan credit card', 'credit', 'loan', 'working capital', 'nabard', 'bank'],
    isDemo: true,
  },
  {
    schemeCode: 'SHC',
    name: 'Soil Health Card Scheme',
    shortName: 'SHC',
    description:
      'Provides farmers with Soil Health Cards indicating the nutrient status of their soil and recommending appropriate fertilizers for crop-specific needs.',
    schemeLevel: 'CENTRAL',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    department: 'Department of Agriculture & Farmers Welfare',
    applicableStates: [],
    applicableDistricts: [],
    targetBeneficiaries: ['All farmers in India'],
    categories: ['soil health', 'fertilizer', 'advisory'],
    benefitsSummary:
      'Free soil testing and printed Soil Health Card with crop-specific fertilizer and soil amendment recommendations.',
    officialSourceUrl: 'https://soilhealth.dac.gov.in',
    applicationUrl: 'https://soilhealth.dac.gov.in',
    applicationMode: 'OFFLINE',
    validFrom: null,
    validUntil: null,
    status: 'ACTIVE',
    lastVerifiedAt: '2022-01-01T00:00:00.000Z',
    verificationNotes: 'Seeded from SHC Scheme Guidelines 2015 (Revised 2022). Verify at soilhealth.dac.gov.in.',
    sourceDocumentIds: [],
    eligibilityRules: [
      // All farmers are eligible — no restriction rules
    ],
    requiredDocuments: [
      { name: 'Aadhaar card or any identity proof', requiredStatus: 'required', condition: null },
      { name: 'Land details (survey number / Khasra number)', requiredStatus: 'required', condition: null },
    ],
    applicationSteps: [
      { order: 1, description: 'Contact your local state agriculture department office or Krishi Vigyan Kendra (KVK).' },
      { order: 2, description: 'A soil sample will be collected from your field by extension staff.' },
      { order: 3, description: 'The sample is tested at a government soil testing laboratory.' },
      { order: 4, description: 'Your Soil Health Card is issued with nutrient status and fertilizer recommendations.' },
    ],
    tags: ['soil health', 'soil testing', 'fertilizer', 'nutrient management', 'free'],
    isDemo: true,
  },
  {
    schemeCode: 'AIF',
    name: 'Agriculture Infrastructure Fund',
    shortName: 'AIF',
    description:
      'Medium to long-term debt financing for investment in post-harvest management and agriculture infrastructure such as warehouses, cold storage, and pack houses.',
    schemeLevel: 'CENTRAL',
    ministry: 'Ministry of Agriculture & Farmers Welfare',
    department: 'Department of Agriculture & Farmers Welfare / Participating Banks',
    applicableStates: [],
    applicableDistricts: [],
    targetBeneficiaries: ['Farmers', 'Farmer Producer Organisations (FPOs)', 'PACS', 'Cooperatives', 'Agri-entrepreneurs'],
    categories: ['infrastructure', 'post-harvest', 'loan', 'storage', 'equipment'],
    benefitsSummary:
      'Interest subvention of 3% per annum for up to 7 years on loans up to ₹2 crore for eligible post-harvest and agri-infrastructure projects.',
    officialSourceUrl: 'https://agriinfra.dac.gov.in',
    applicationUrl: 'https://agriinfra.dac.gov.in',
    applicationMode: 'ONLINE',
    validFrom: null,
    validUntil: null,
    status: 'ACTIVE',
    lastVerifiedAt: '2020-07-01T00:00:00.000Z',
    verificationNotes: 'Seeded from AIF Scheme Guidelines 2020. Verify current terms at agriinfra.dac.gov.in.',
    sourceDocumentIds: [],
    eligibilityRules: [],
    requiredDocuments: [
      { name: 'Identity proof', requiredStatus: 'required', condition: null },
      { name: 'Detailed project report', requiredStatus: 'required', condition: null },
      { name: 'Land or lease records', requiredStatus: 'required', condition: null },
      { name: 'Bank statements', requiredStatus: 'required', condition: null },
    ],
    applicationSteps: [
      { order: 1, description: 'Prepare a detailed project report for your infrastructure investment.' },
      { order: 2, description: 'Apply via the agriinfra.dac.gov.in portal.' },
      { order: 3, description: 'The bank evaluates project feasibility.' },
      { order: 4, description: 'Loan is sanctioned with the interest subvention benefit applied.' },
    ],
    tags: ['aif', 'infrastructure', 'cold storage', 'warehouse', 'pack house', 'fpo', 'loan', 'interest subvention'],
    isDemo: true,
  },
]

// ── Seed runner ───────────────────────────────────────────────────────────────

/**
 * Run the scheme seed.
 * Idempotent — skips existing records by schemeCode.
 *
 * @returns {Promise<{inserted: number, skipped: number, failed: number}>}
 */
export async function runSchemeSeed() {
  let inserted = 0
  let skipped = 0
  let failed = 0

  for (const definition of SEED_SCHEMES) {
    try {
      // Check if this schemeCode already exists
      const existing = await findByCode(definition.schemeCode)
      if (existing) {
        logger.info(`Scheme seed: skipping existing record`, { schemeCode: definition.schemeCode })
        skipped++
        continue
      }

      const record = createSchemeRecord(definition)
      await createScheme(record)
      logger.info(`Scheme seed: inserted`, {
        schemeCode: record.schemeCode,
        schemeId: record.schemeId,
      })
      inserted++
    } catch (err) {
      logger.error(`Scheme seed: failed for ${definition.schemeCode}`, { error: err.message })
      failed++
    }
  }

  return { inserted, skipped, failed, total: SEED_SCHEMES.length }
}

// ── CLI entry point ───────────────────────────────────────────────────────────

// Run only when executed directly (node ... schemes.seed.js)
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('schemes.seed.js') ||
    process.argv[1].endsWith('schemes.seed'))

if (isMain) {
  ;(async () => {
    try {
      // Try to connect to MongoDB; seed proceeds with in-memory fallback if unavailable
      try {
        await connectDb()
        console.log('[SchemeSeed] MongoDB connected')
      } catch {
        console.log('[SchemeSeed] MongoDB unavailable — seeding to in-memory store')
      }

      const result = await runSchemeSeed()
      console.log(
        `[SchemeSeed] Complete — inserted: ${result.inserted}, skipped: ${result.skipped}, failed: ${result.failed}`
      )
      process.exit(result.failed > 0 ? 1 : 0)
    } catch (err) {
      console.error('[SchemeSeed] Fatal error:', err.message)
      process.exit(1)
    }
  })()
}
