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

function loadEnvFromFile(filePath: string, env: NodeJS.ProcessEnv) {
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

export function getMissingEnvVars(env: NodeJS.ProcessEnv = process.env) {
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

export function verifyEnv(env: NodeJS.ProcessEnv = process.env) {
  const missing = getMissingEnvVars(env)

  if (missing.length > 0) {
    console.error('Missing required environment variables: ' + missing.join(', '))
    console.error('Please set these variables before running the app or CI.')
    process.exit(1)
  }

  console.log('Environment check passed. All required environment variables are set.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyEnv()
}
