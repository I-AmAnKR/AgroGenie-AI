#!/usr/bin/env node
/**
 * AgroGenie AI — Deployment Verification Script
 * Step 17 Part 8
 *
 * Verifies that all core features are working before/after deployment.
 * Runs a series of lightweight checks against a running server.
 *
 * Usage:
 *   node server/scripts/verify-deployment.mjs
 *   node server/scripts/verify-deployment.mjs https://your-production-url.com
 *
 * Set BASE_URL environment variable or pass as first argument.
 * Defaults to http://localhost:5000 (local development).
 */

const BASE_URL = process.argv[2] || process.env.BASE_URL || 'http://localhost:5000'
const API = `${BASE_URL}/api/v1`

const PASS = '✅'
const FAIL = '❌'
const WARN = '⚠️'
const INFO = 'ℹ️'

let passed = 0
let failed = 0
let warned = 0

/**
 * Make an HTTP GET request.
 */
async function get(path) {
  const res = await fetch(`${API}${path}`)
  const json = await res.json().catch(() => ({}))
  return { status: res.status, ok: res.ok, body: json }
}

/**
 * Make an HTTP POST request.
 */
async function post(path, data) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, ok: res.ok, body: json }
}

/**
 * Log a check result.
 */
function check(label, ok, message = '', warn = false) {
  if (ok) {
    passed++
    console.log(`  ${PASS} ${label}${message ? ': ' + message : ''}`)
  } else if (warn) {
    warned++
    console.log(`  ${WARN} ${label}${message ? ': ' + message : ''} (warning only)`)
  } else {
    failed++
    console.log(`  ${FAIL} ${label}${message ? ': ' + message : ''}`)
  }
}

/**
 * Log section header.
 */
function section(title) {
  console.log(`\n── ${title} ──────────────────────────────────────────`)
}

/**
 * Run all verification checks.
 */
async function verify() {
  console.log(`\n🌾 AgroGenie AI — Deployment Verification`)
  console.log(`   Target: ${BASE_URL}`)
  console.log(`   Time:   ${new Date().toISOString()}`)

  // ── 1. Liveness ────────────────────────────────────────────────────────
  section('1. Server Liveness')
  try {
    const { status, body } = await get('/health')
    check('GET /health returns 200', status === 200)
    check('health.status = ok', body.data?.status === 'ok')
    check('health.server = running', body.data?.server === 'running')
    check('health.version present', !!body.data?.version)
    check('health.uptime > 0', body.data?.uptime > 0)
    check('health.database present', body.data?.database !== undefined)
    check('health.ai present', body.data?.ai !== undefined)
    check('health.storage present', body.data?.storage !== undefined)
    check('health.stt present', body.data?.stt !== undefined)
    check('health.tts present', body.data?.tts !== undefined)
    check('health.timestamp present', !!body.data?.timestamp)
    check('meta.requestId present', !!body.meta?.requestId)
  } catch (err) {
    check('Server reachable', false, `Cannot connect to ${BASE_URL}: ${err.message}`)
    console.log('\n❌ Server unreachable — stopping verification.\n')
    process.exit(1)
  }

  // ── 2. Readiness ───────────────────────────────────────────────────────
  section('2. Readiness Probe')
  try {
    const { status, body } = await get('/health/ready')
    check('GET /health/ready returns 200 or 503', [200, 503].includes(status))
    check('ready.status present', !!body.data?.status)
    check('ready.checks present', !!body.data?.checks)
    const checks = body.data?.checks || {}
    check('ready.checks.mongodb present', 'mongodb' in checks || 'database' in checks)
    check('ready.checks.ibmGranite present', 'ibmGranite' in checks, '', true)
    check('ready.checks.ibmCOS present', 'ibmCOS' in checks, '', true)
  } catch (err) {
    check('Readiness probe', false, err.message)
  }

  // ── 3. Security Headers ────────────────────────────────────────────────
  section('3. Security Headers (Helmet)')
  try {
    const res = await fetch(`${API}/health`)
    const headers = res.headers
    check('X-Content-Type-Options: nosniff', headers.get('x-content-type-options') === 'nosniff')
    check('X-Frame-Options present', !!headers.get('x-frame-options'))
    check('Content-Security-Policy present', !!headers.get('content-security-policy'))
    check('X-Request-ID present', !!headers.get('x-request-id'))
  } catch (err) {
    check('Security headers', false, err.message)
  }

  // ── 4. Chat Endpoint (Mock Mode) ───────────────────────────────────────
  section('4. Chat Endpoint (Agent Router)')
  try {
    const { status, body } = await post('/chat', {
      message: 'What crops should I grow in Rabi season in Punjab?',
      language: 'en',
    })
    check('POST /chat returns 200', status === 200)
    check('chat.conversationId present', !!body.data?.conversationId)
    check('chat.message.content present', !!body.data?.message?.content)
    check('chat.routing.intent present', !!body.data?.routing?.intent)
    check('chat.agentActivity is array', Array.isArray(body.data?.agentActivity))
    check('chat.sources is array', Array.isArray(body.data?.sources))
    check('chat.grounded present', typeof body.data?.grounded === 'boolean')
  } catch (err) {
    check('Chat endpoint', false, err.message)
  }

  // ── 5. Weather Endpoint ────────────────────────────────────────────────
  section('5. Weather Agent')
  try {
    const { status, body } = await post('/chat', {
      message: 'What is the weather today in Ludhiana Punjab?',
      language: 'en',
    })
    check('Weather chat returns 200', status === 200)
    check('Weather intent or General', ['WEATHER', 'GENERAL'].includes(body.data?.routing?.intent))
    check('Weather response has content', !!body.data?.message?.content)
  } catch (err) {
    check('Weather endpoint', false, err.message)
  }

  // ── 6. Knowledge Base ──────────────────────────────────────────────────
  section('6. Knowledge Base')
  try {
    const { status, body } = await get('/knowledge/documents')
    check('GET /knowledge/documents returns 200', status === 200)
    check('Knowledge list is array', Array.isArray(body.data?.documents))
  } catch (err) {
    check('Knowledge base', false, err.message)
  }

  // ── 7. Monitoring Dashboard ────────────────────────────────────────────
  section('7. Monitoring Dashboard API')
  try {
    const { status, body } = await get('/monitoring/status')
    check('GET /monitoring/status returns 200', status === 200)
    check('monitoring.services present', !!body.data?.services)
    check('monitoring.overallHealth present', !!body.data?.overallHealth)
    check('monitoring.uptime > 0', body.data?.uptime > 0)

    const { status: statsStatus, body: statsBody } = await get('/monitoring/stats')
    check('GET /monitoring/stats returns 200', statsStatus === 200)
    check('stats.totalConversations present', typeof statsBody.data?.totalConversations === 'number')
  } catch (err) {
    check('Monitoring API', false, err.message)
  }

  // ── 8. 404 Handler ─────────────────────────────────────────────────────
  section('8. Error Handling')
  try {
    const { status, body } = await get('/this-route-does-not-exist')
    check('Unknown route returns 404', status === 404)
    check('404 error.code = NOT_FOUND', body.error?.code === 'NOT_FOUND')
    check('success = false on error', body.success === false)
  } catch (err) {
    check('Error handling', false, err.message)
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════')
  console.log(`  ${PASS} Passed: ${passed}`)
  if (warned > 0) console.log(`  ${WARN} Warnings: ${warned}`)
  if (failed > 0) console.log(`  ${FAIL} Failed: ${failed}`)
  console.log('══════════════════════════════════════════════════════\n')

  if (failed > 0) {
    console.log('❌ Deployment verification FAILED\n')
    process.exit(1)
  } else {
    console.log('✅ Deployment verification PASSED\n')
    process.exit(0)
  }
}

verify().catch(err => {
  console.error('Verification script error:', err)
  process.exit(1)
})
