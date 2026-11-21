import { config } from '@/lib/config'
import { getMissingEnvVars } from '@/scripts/verify-env'

export interface DependencyCheck {
  status: 'up' | 'down'
  latencyMs?: number
  error?: string
}

export interface ReadinessResult {
  ready: boolean
  checks: {
    database: DependencyCheck
    storage: DependencyCheck
    environment: DependencyCheck
  }
  timestamp: string
}

export interface LivenessResult {
  alive: boolean
  uptime: number
  timestamp: string
}

export interface StatusResult {
  version: string
  build: string
  environment: string
  uptime: number
  memory: {
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
  }
  node: {
    version: string
    platform: string
  }
  hostname: string
  timestamp: string
}

function publicCheck(check: DependencyCheck): DependencyCheck {
  return check.status === 'down'
    ? { status: 'down', latencyMs: check.latencyMs, error: 'Dependency check failed' }
    : check
}

export function toPublicReadiness(result: ReadinessResult): ReadinessResult {
  return {
    ...result,
    checks: {
      database: publicCheck(result.checks.database),
      storage: publicCheck(result.checks.storage),
      environment: publicCheck(result.checks.environment),
    },
  }
}

async function timedCheck(fn: () => Promise<void>): Promise<DependencyCheck> {
  const start = performance.now()
  try {
    await fn()
    return { status: 'up', latencyMs: Math.round(performance.now() - start) }
  } catch (err) {
    const error = err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String(err.message)
        : String(err)
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - start),
      error,
    }
  }
}

export async function checkReadiness(): Promise<ReadinessResult> {
  const timestamp = new Date().toISOString()

  const missingEnv = getMissingEnvVars()
  const environment: DependencyCheck = {
    status: missingEnv.length === 0 ? 'up' : 'down',
    error: missingEnv.length ? `Missing: ${missingEnv.join(', ')}` : undefined,
  }

  const [database, storage] = await Promise.all([
    timedCheck(async () => {
      const { getDatabase, getAuthDatabase } = await import('@/lib/postgres/db')
      const { sql } = await import('drizzle-orm')
      const appDb = getDatabase()
      const authDb = getAuthDatabase()
      await Promise.all([
        appDb.execute(sql`select 1 from public.profiles limit 1`),
        authDb.execute(sql`
          select 1 from public.profiles
          cross join private_auth.credentials
          cross join private_auth.sessions
          limit 1
        `),
      ])
    }),
    timedCheck(async () => {
      const { access, mkdir, constants } = await import('node:fs/promises')
      const storagePath = process.env.LOCAL_STORAGE_PATH ?? './.local-storage'
      try {
        await access(storagePath, constants.R_OK | constants.W_OK)
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
          await mkdir(storagePath, { recursive: true, mode: 0o700 })
          await access(storagePath, constants.R_OK | constants.W_OK)
        } else {
          throw err
        }
      }
    }),
  ])

  const ready =
    environment.status === 'up' && database.status === 'up' && storage.status === 'up'

  return {
    ready,
    checks: { database, storage, environment },
    timestamp,
  }
}

export function checkLiveness(): LivenessResult {
  return {
    alive: true,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  }
}

export function getStatusSnapshot(): StatusResult {
  const mem = process.memoryUsage()
  return {
    version: config.app.version,
    build: config.app.buildId,
    environment: config.env.nodeEnv,
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    },
    node: {
      version: process.version,
      platform: process.platform,
    },
    hostname: process.env.HOSTNAME ?? process.env.VERCEL_URL ?? 'localhost',
    timestamp: new Date().toISOString(),
  }
}
