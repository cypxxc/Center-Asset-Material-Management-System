import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const requiredEnv = ['DATABASE_URL', 'DATABASE_AUTH_URL', 'LOCAL_STORAGE_PATH'] as const

function loadEnvFromFile(filePath: string, env: Record<string, string | undefined>) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match || match[0].startsWith('#')) continue
    const [, key, raw] = match
    if (!env[key]?.trim()) env[key] = raw.trim().replace(/^['"]|['"]$/g, '')
  }
}

function mergedEnvironment(env: Record<string, string | undefined>) {
  const merged = { ...env }
  for (const file of ['.env.local', '.env']) loadEnvFromFile(path.resolve(process.cwd(), file), merged)
  if (merged.CI === 'true') {
    merged.DATABASE_URL ||= 'postgres://camms:build-only@127.0.0.1:5432/camms'
    merged.DATABASE_AUTH_URL ||= 'postgres://camms:build-only@127.0.0.1:5432/camms'
    merged.LOCAL_STORAGE_PATH ||= './.local-storage'
  }
  return merged
}

export function getMissingEnvVars(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>) {
  const merged = mergedEnvironment(env)
  return requiredEnv.filter(key => !merged[key]?.trim())
}

export function verifyEnv(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>) {
  const merged = mergedEnvironment(env)
  const missing = requiredEnv.filter(key => !merged[key]?.trim())
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`)
    console.error('Set these PostgreSQL and local storage settings before starting CAMMS.')
    process.exit(1)
  }
  for (const key of ['DATABASE_URL', 'DATABASE_AUTH_URL'] as const) {
    try {
      const url = new URL(merged[key]!)
      if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.username || !url.password || url.pathname === '/') throw new Error()
    } catch {
      console.error(`Invalid PostgreSQL connection setting: ${key}`)
      process.exit(1)
    }
  }
  console.log('PostgreSQL environment check passed.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) verifyEnv()
