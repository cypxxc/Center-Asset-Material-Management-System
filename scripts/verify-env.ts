const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]

const missing = requiredEnv.filter((key) => !process.env[key] || !process.env[key]?.trim())

if (missing.length > 0) {
  console.error('Missing required environment variables: ' + missing.join(', '))
  console.error('Please set these variables before running the app or CI.')
  process.exit(1)
}

console.log('Environment check passed. All required environment variables are set.')
