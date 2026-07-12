import app from './app.js'
import config from './config/env.js'
import logger from './utils/logger.js'
import { connect as connectDb, close as closeDb } from './services/db.service.js'

const PORT = config.server.port

let server = null

async function start() {
  try {
    if (config.db.uri) {
      await connectDb()
    } else {
      logger.warn('No DB URI provided — running without database')
    }

    server = app.listen(PORT, () => {
      logger.info(`AgroGenie AI server started`, {
        port: PORT,
        env: config.server.nodeEnv,
        version: config.server.version,
        mockProviders: config.providers.useMocks,
        demoMode: config.demo.enabled,
        health: `http://localhost:${PORT}/api/v1/health`,
        ready: `http://localhost:${PORT}/api/v1/health/ready`,
      })
    })

    // ── Phase 17A: handle listen errors (e.g. port already in use) ──────────
    server.on('error', (err) => {
      logger.error('HTTP server error', { error: err.message, code: err.code })
      process.exit(1)
    })
  } catch (err) {
    logger.error('Failed to start server', { error: err.message })
    // Exit non-zero so process managers know startup failed
    process.exit(1)
  }
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(reason = 'SIGTERM') {
  try {
    logger.info(`${reason} received — shutting down gracefully`)
    if (server) {
      await new Promise(resolve => server.close(resolve))
      logger.info('HTTP server closed — no more connections accepted')
    }
    await closeDb()
    logger.info('Shutdown complete')
  } catch (err) {
    logger.warn('Error during shutdown', { error: err.message })
  } finally {
    process.exit(0)
  }
}

// ── Phase 17A: Process-level safety net ─────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception — shutting down', { error: err.message, stack: err.stack })
  shutdown('uncaughtException')
})

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  logger.error('Unhandled promise rejection', { reason: message })
  // Do not exit — allow the process to continue unless it becomes fatal
})

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

start()

export default server
