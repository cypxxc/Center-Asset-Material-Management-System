import packageJson from '../package.json'

/** Centralized runtime configuration — validated at read time, no magic numbers in features. */
export const config = {
  app: {
    name: 'CAMMS',
    version: packageJson.version,
    buildId: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.BUILD_ID ?? 'local',
  },

  env: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV !== 'production',
    logLevel: (process.env.LOG_LEVEL ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  },

  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    storageBucket: 'item-images',
  },

  limits: {
    rateLimitDefault: 30,
    rateLimitWindowMs: 60_000,
    loginRateLimit: 10,
    loginRateLimitWindowMs: 60_000,
    csvImportRateLimit: 5,
    csvImportRateLimitWindowMs: 300_000,
    imageMaxBytes: 5 * 1024 * 1024,
    adminSqlTimeoutMs: 30_000,
    supabaseQueryTimeoutMs: 15_000,
    exportTimeoutMs: 120_000,
  },

  cache: {
    referencesTtlMs: 60_000,
    sidebarLayoutRevalidate: true,
  },

  retry: {
    maxAttempts: 3,
    baseDelayMs: 200,
    maxDelayMs: 5_000,
    jitterFactor: 0.25,
  },

  observability: {
    slowActionThresholdMs: 2_000,
    slowQueryThresholdMs: 1_000,
    metricsEnabled: process.env.METRICS_ENABLED !== 'false',
  },

  featureFlags: {
    /** Parsed from FEATURE_FLAGS env: comma-separated key=value pairs */
    envPrefix: 'FEATURE_',
  },
} as const

export type AppConfig = typeof config

export function getRequiredEnvKeys(): readonly string[] {
  return [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ] as const
}

export function validateEnvConfig(env: Record<string, string | undefined> = process.env): {
  valid: boolean
  missing: string[]
} {
  const missing = getRequiredEnvKeys().filter((key) => !env[key]?.trim())
  return { valid: missing.length === 0, missing: [...missing] }
}
