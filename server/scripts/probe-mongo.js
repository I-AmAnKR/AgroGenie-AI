/**
 * MongoDB Atlas direct-connect probe.
 * Uses a pre-resolved mongodb:// URI to bypass the SRV DNS issue on Windows/Node.js.
 */
import 'dotenv/config'
import { MongoClient } from 'mongodb'

const DB_NAME = process.env.MONGODB_DB_NAME ?? 'agrogenie'

// Credentials from env URI
const URI_SRV = process.env.MONGODB_URI
const credMatch = URI_SRV?.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@/)
const username  = credMatch?.[1] ?? ''
const password  = credMatch?.[2] ?? ''

// Direct connection URI using OS-resolved shard hosts (bypasses Node libuv SRV bug)
const HOSTS = [
  'ac-xoqkimc-shard-00-00.lvozcc2.mongodb.net:27017',
  'ac-xoqkimc-shard-00-01.lvozcc2.mongodb.net:27017',
  'ac-xoqkimc-shard-00-02.lvozcc2.mongodb.net:27017',
].join(',')

const DIRECT_URI = `mongodb://${username}:${password}@${HOSTS}/${DB_NAME}?replicaSet=atlas-vvesh9-shard-0&tls=true&authSource=admin&appName=AgroGenieCluster`

console.log('\n════════════════════════════════════════════════════════')
console.log('  AgroGenie AI — MongoDB Atlas Connection Probe v4')
console.log('════════════════════════════════════════════════════════')
console.log('  User         :', username)
console.log('  Hosts        : 3 atlas shards (direct)')
console.log('  ReplicaSet   : atlas-vvesh9-shard-0')
console.log('  Database     :', DB_NAME)
console.log('────────────────────────────────────────────────────────')

const client = new MongoClient(DIRECT_URI, {
  connectTimeoutMS: 15000,
  serverSelectionTimeoutMS: 15000,
})

const start = Date.now()
try {
  console.log('\n  Connecting to Atlas...')
  await client.connect()
  const elapsed = Date.now() - start

  await client.db('admin').command({ ping: 1 })

  const db   = client.db(DB_NAME)
  const cols = await db.listCollections().toArray()

  console.log('\n════════════════════════════════════════════════════════')
  console.log('  STATUS      :  ✅  CONNECTED TO ATLAS')
  console.log(`  LATENCY     :  ${elapsed} ms`)
  console.log(`  DATABASE    :  ${DB_NAME}`)
  console.log(`  COLLECTIONS :  ${cols.length === 0 ? '(none — fresh database, ready for Phase 5)' : cols.map(c => c.name).join(', ')}`)
  console.log('════════════════════════════════════════════════════════\n')
  process.exit(0)

} catch (err) {
  const elapsed = Date.now() - start
  console.log('\n════════════════════════════════════════════════════════')
  console.log('  STATUS      :  ❌  FAILED')
  console.log(`  LATENCY     :  ${elapsed} ms`)
  console.log(`  ERROR       :  ${err.message}`)
  console.log('════════════════════════════════════════════════════════\n')

  if (err.message.match(/auth|credential|password|user/i)) {
    console.log('  FIX → Atlas console → Database Access → verify username/password\n')
  } else if (err.message.match(/ECONNREFUSED|ETIMEDOUT|connect/i)) {
    console.log('  FIX → Atlas console → Network Access → add IP: 103.199.123.137\n')
  }
  process.exit(1)
} finally {
  await client.close().catch(() => {})
}
