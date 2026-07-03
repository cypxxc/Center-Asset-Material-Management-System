import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

const ciFallbackValues: Record<(typeof requiredEnv)[number], string> = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'example-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'example-service-role-key',
}

function loadEnvFromFile(filePath: string, env: Record<string, string | undefined>) {
  if (!fs.existsSync(filePath)) {
    return
  }

  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) {
      continue
    }

    const [, key, rawValue] = match
    const value = rawValue.trim()
    const unquoted = value.replace(/^['"]|['"]$/g, '')

    if (!env[key] || !env[key]?.trim()) {
      env[key] = unquoted
    }
  }
}

export function getMissingEnvVars(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>) {
  const mergedEnv = { ...env }

  const envFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
  ]

  for (const envFile of envFiles) {
    loadEnvFromFile(envFile, mergedEnv)
  }

  if (mergedEnv.CI === 'true') {
    for (const key of requiredEnv) {
      if (!mergedEnv[key] || !mergedEnv[key]?.trim()) {
        mergedEnv[key] = ciFallbackValues[key]
      }
    }
  }

  return requiredEnv.filter((key) => !mergedEnv[key] || !mergedEnv[key]?.trim())
}

export function verifyEnv(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>) {
  const missing = getMissingEnvVars(env)

  if (missing.length > 0) {
    console.error('Missing required environment variables: ' + missing.join(', '))
    console.error('Please set these variables before running the app or CI.')
    process.exit(1)
  }

  // Load config variables again
  const mergedEnv = { ...env }
  const envFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
  ]
  for (const envFile of envFiles) {
    loadEnvFromFile(envFile, mergedEnv)
  }

  if (mergedEnv.CI === 'true') {
    for (const key of requiredEnv) {
      if (!mergedEnv[key] || !mergedEnv[key]?.trim()) {
        mergedEnv[key] = ciFallbackValues[key]
      }
    }
  }

  const isProd = mergedEnv.NODE_ENV === 'production'
  const isCI = mergedEnv.CI === 'true'

  const supabaseUrl = mergedEnv.NEXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = mergedEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const serviceKey = mergedEnv.SUPABASE_SERVICE_ROLE_KEY || ''

  // 1. URL formatting checks
  try {
    const url = new URL(supabaseUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      console.error(`Invalid URL scheme for NEXT_PUBLIC_SUPABASE_URL: ${url.protocol}`)
      process.exit(1)
    }
  } catch {
    console.error(`Invalid URL format for NEXT_PUBLIC_SUPABASE_URL: "${supabaseUrl}"`)
    process.exit(1)
  }

  // 2. Minimum length checking for keys
  if (anonKey.length < 15) {
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is too short to be a valid token')
    process.exit(1)
  }
  if (serviceKey.length < 15) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is too short to be a valid token')
    process.exit(1)
  }

  // 3. Prohibit placeholders exclusively in actual production deploys (Node production && not CI builds)
  if (isProd && !isCI) {
    if (supabaseUrl.includes('example.supabase.co')) {
      console.error(`Forbidden placeholder URL in production: "${supabaseUrl}"`)
      process.exit(1)
    }
    if (anonKey.includes('example-anon-key')) {
      console.error('Forbidden placeholder Anon Key in production')
      process.exit(1)
    }
    if (serviceKey.includes('example-service-role-key')) {
      console.error('Forbidden placeholder Service Key in production')
      process.exit(1)
    }
  }

  console.log('Environment check passed. All required environment variables are set and validated.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyEnv()
}
