import { createServiceRoleClient } from '@/lib/supabase/server'
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
  featureFlags?: Record<string, unknown>
}

async function timedCheck(fn: () => Promise<void>): Promise<DependencyCheck> {
  const start = performance.now()
  try {
    await fn()
    return { status: 'up', latencyMs: Math.round(performance.now() - start) }
  } catch (err) {
    return {
      status: 'down',
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : String(err),
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

  const database = await timedCheck(async () => {
    const supabase = createServiceRoleClient()
    const { error } = await supabase.from('profiles').select('id').limit(1).maybeSingle()
    if (error) throw error
  })

  const storage = await timedCheck(async () => {
    const supabase = createServiceRoleClient()
    const { error } = await supabase.storage.from(config.supabase.storageBucket).list('', { limit: 1 })
    if (error) throw error
  })

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

export function getStatusSnapshot(includeFlags = false): StatusResult {
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
    ...(includeFlags ? { featureFlags: {} } : {}),
  }
}

/** Backward-compatible aggregate used by legacy /api/health */
export async function checkLegacyHealth() {
  const readiness = await checkReadiness()
  const liveness = checkLiveness()
  const status = getStatusSnapshot()

  const isHealthy = readiness.ready && liveness.alive

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    version: status.version,
    environment: status.environment,
    database: readiness.checks.database.status,
    storage: readiness.checks.storage.status,
    uptime: liveness.uptime,
    timestamp: status.timestamp,
  }
}
