import { spawn } from 'node:child_process'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'dotenv'
import { Pool } from 'pg'

const stagingEnvFile = '.env.staging'
if (!existsSync(stagingEnvFile)) {
  console.error('Missing .env.staging file')
  process.exit(1)
}

const stagingEnv = parse(readFileSync(stagingEnvFile))
if (!stagingEnv.DATABASE_URL?.includes('/camms_staging')) {
  console.error('FATAL: DATABASE_URL does not point to camms_staging! Refusing to start.')
  process.exit(1)
}

// Ensure local storage directory exists with absolute path
const storagePath = path.resolve(stagingEnv.LOCAL_STORAGE_PATH || './.local-storage-staging')
mkdirSync(storagePath, { recursive: true })

// Verify direct connection to camms_staging
const verifyPool = new Pool({ connectionString: stagingEnv.DATABASE_URL, connectionTimeoutMillis: 5000 })
verifyPool.query('SELECT current_database() as db').then((res) => {
  const connectedDb = res.rows[0].db
  if (connectedDb !== 'camms_staging') {
    console.error(`FATAL: Connected to database ${connectedDb} instead of camms_staging! Halting immediately.`)
    process.exit(1)
  }
  console.log(`[Staging Server] Verified database target: ${connectedDb} (ISOLATED)`)
  verifyPool.end()

  // Set environment variables for the child process:
  // Use NODE_ENV=staging so secure: false allows cookies over local HTTP (127.0.0.1:3001)
  const childEnv = {
    ...process.env,
    ...stagingEnv,
    LOCAL_STORAGE_PATH: storagePath,
    PORT: '3001',
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'staging',
  }

  console.log('[Staging Server] Launching Standalone Next.js on http://127.0.0.1:3001 ...')
  const standaloneDir = path.resolve('.next/standalone')
  const nextProcess = spawn('node', ['server.js'], {
    cwd: standaloneDir,
    env: childEnv as unknown as NodeJS.ProcessEnv,
    stdio: 'inherit',
  })

  nextProcess.on('exit', (code: number | null) => {
    console.log(`[Staging Server] Next.js process exited with code ${code}`)
    process.exit(code ?? 0)
  })

  process.on('SIGINT', () => { nextProcess.kill('SIGINT') })
  process.on('SIGTERM', () => { nextProcess.kill('SIGTERM') })
}).catch((err) => {
  console.error('FATAL: Could not verify connection to camms_staging:', err)
  process.exit(1)
})
