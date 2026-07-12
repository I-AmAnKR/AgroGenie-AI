import { MongoClient } from 'mongodb'
import config from '../config/env.js'
import logger from '../utils/logger.js'

let client = null
let database = null

/**
 * Connect to MongoDB using configured URI.
 * On Windows, if an SRV URI causes issues, a direct-host fallback is attempted.
 */
export async function connect() {
  const uri = config.db.uri
  if (!uri) {
    logger.warn('No MongoDB URI configured — skipping DB connection')
    return
  }

  let connectUri = uri

  // Fallback for known SRV resolution issues on some Windows setups
  if (connectUri.startsWith('mongodb+srv://') && process.platform === 'win32') {
    const credMatch = connectUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@/)
    const username = credMatch?.[1] ?? ''
    const password = credMatch?.[2] ?? ''

    // These hosts match the project's Atlas cluster used in the probe script.
    const HOSTS = [
      'ac-xoqkimc-shard-00-00.lvozcc2.mongodb.net:27017',
      'ac-xoqkimc-shard-00-01.lvozcc2.mongodb.net:27017',
      'ac-xoqkimc-shard-00-02.lvozcc2.mongodb.net:27017',
    ].join(',')

    connectUri = `mongodb://${username}:${password}@${HOSTS}/${config.db.name}?replicaSet=atlas-vvesh9-shard-0&tls=true&authSource=admin&appName=AgroGenieCluster`
    logger.info('Using direct-host MongoDB URI fallback for Windows')
  }

  client = new MongoClient(connectUri, {
    connectTimeoutMS: 15000,
    serverSelectionTimeoutMS: 15000,
  })

  await client.connect()
  database = client.db(config.db.name)
  logger.info('Connected to MongoDB', { database: config.db.name })
}

export function getDb() {
  if (!database) throw new Error('MongoDB not connected')
  return database
}

export async function close() {
  try {
    await client?.close()
    logger.info('MongoDB connection closed')
  } catch (err) {
    logger.warn('Error closing MongoDB connection', { error: err.message })
  }
}
