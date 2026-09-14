import { createServerClient } from '@supabase/ssr'
import { config as loadEnv } from 'dotenv'

// Use a dedicated account through the existing E2E environment variables.
// Credentials and session cookies stay in memory and are never printed.
loadEnv({ path: '.env.local', quiet: true })

async function main() {
  const email = process.env.CAMMS_E2E_ADMIN_ID
  const password = process.env.CAMMS_E2E_ADMIN_PASSWORD
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!email || !password || !supabaseUrl || !anonKey) {
    throw new Error('Set CAMMS_E2E_ADMIN_ID, CAMMS_E2E_ADMIN_PASSWORD and the Supabase environment variables before benchmarking.')
  }
  const base = new URL(process.env.CAMMS_BENCHMARK_URL ?? 'http://localhost:3000')
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) {
    throw new Error('Use HTTPS for remote benchmarks.')
  }
  const jar = new Map<string, string>()
  const supabase = createServerClient(supabaseUrl, anonKey, {
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: cookies => cookies.forEach(({ name, value }) => { jar.set(name, value) }),
    },
  })
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Benchmark sign-in failed (${error.code ?? error.status ?? 'network error'}).`)
  try {
    let exceeded = false
    for (const path of ['/dashboard', '/items', '/items?type=asset', '/items?type=material', '/locations', '/reports']) {
      const samples: number[] = []
      const headersTimes: number[] = []
      for (let sample = 0; sample < 11; sample++) {
        const start = performance.now()
        const response = await fetch(new URL(path, base), {
          headers: { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') },
          redirect: 'manual',
          signal: AbortSignal.timeout(30_000),
        })
        const headersMs = performance.now() - start
        const body = await response.text()
        const totalMs = performance.now() - start
        if (response.status !== 200 || body.includes('NEXT_REDIRECT;') || body.includes('id="__next_error__"')) {
          throw new Error(`${path} did not return an authenticated page (HTTP ${response.status}).`)
        }
        for (const cookie of response.headers.getSetCookie()) {
          const pair = cookie.split(';', 1)[0]
          const separator = pair.indexOf('=')
          if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1))
        }
        samples.push(totalMs)
        headersTimes.push(headersMs)
      }
      const warm = samples.slice(1).sort((a, b) => a - b)
      const max = warm.at(-1)!
      exceeded ||= max > 250
      console.log(JSON.stringify({
        path, firstRequestMs: Math.round(samples[0]), samples: warm.length,
        warmMedianMs: Math.round((warm[4] + warm[5]) / 2),
        warmP95Ms: Math.round(warm[Math.ceil(warm.length * 0.95) - 1]),
        warmMaxMs: Math.round(max),
        warmHeadersAverageMs: Math.round(headersTimes.slice(1).reduce((a, b) => a + b, 0) / 10),
        fullResponseUnder250Ms: max <= 250,
      }))
    }
    if (exceeded) process.exitCode = 1
  } finally {
    await supabase.auth.signOut({ scope: 'local' })
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Benchmark failed')
  process.exitCode = 1
})
