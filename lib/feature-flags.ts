import { config } from '@/lib/config'

export type FlagValue = boolean | number | string

type FlagDefinition = {
  default: FlagValue
  envKey?: string
  /** Percentage rollout 0–100 (future-ready; uses deterministic hash when userId provided). */
  rolloutPercent?: number
}

const FLAG_REGISTRY: Record<string, FlagDefinition> = {
  METRICS_ENABLED: { default: true, envKey: 'FEATURE_METRICS_ENABLED' },
  STRUCTURED_HEALTH: { default: true, envKey: 'FEATURE_STRUCTURED_HEALTH' },
  ENHANCED_TRACING: { default: true, envKey: 'FEATURE_ENHANCED_TRACING' },
  CSV_IMPORT_V2: { default: false, envKey: 'FEATURE_CSV_IMPORT_V2', rolloutPercent: 0 },
}

function parseEnvFlag(raw: string | undefined): FlagValue | undefined {
  if (raw === undefined || raw === '') return undefined
  if (raw === 'true') return true
  if (raw === 'false') return false
  const num = Number(raw)
  if (!Number.isNaN(num)) return num
  return raw
}

function hashToPercent(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 100
}

/** Lightweight feature flags — env-based, no external service. */
export const featureFlags = {
  isEnabled(name: keyof typeof FLAG_REGISTRY, context?: { userId?: string }): boolean {
    const def = FLAG_REGISTRY[name]
    if (!def) return false

    const envVal = parseEnvFlag(process.env[def.envKey ?? `${config.featureFlags.envPrefix}${name}`])
    let value: FlagValue = envVal ?? def.default

    if (typeof value === 'number') {
      value = value !== 0
    }

    if (typeof value !== 'boolean') {
      value = Boolean(value)
    }

    if (!value) return false

    if (def.rolloutPercent !== undefined && def.rolloutPercent < 100) {
      if (!context?.userId) return def.rolloutPercent >= 100
      return hashToPercent(`${name}:${context.userId}`) < def.rolloutPercent
    }

    return true
  },

  getValue(name: keyof typeof FLAG_REGISTRY): FlagValue {
    const def = FLAG_REGISTRY[name]
    if (!def) return false
    return parseEnvFlag(process.env[def.envKey ?? `${config.featureFlags.envPrefix}${name}`]) ?? def.default
  },

  list(): Record<string, FlagValue> {
    const out: Record<string, FlagValue> = {}
    for (const name of Object.keys(FLAG_REGISTRY) as Array<keyof typeof FLAG_REGISTRY>) {
      out[name] = this.getValue(name)
    }
    return out
  },
}

export type FeatureFlags = typeof featureFlags
