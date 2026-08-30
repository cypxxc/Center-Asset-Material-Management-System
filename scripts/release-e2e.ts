import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export function validateReleaseE2EEnv(env: NodeJS.ProcessEnv): string[] {
  const errors: string[] = []

  if (env.CAMMS_E2E_REAL_AUTH !== 'true') {
    errors.push('CAMMS_E2E_REAL_AUTH must be set to true')
  }
  if (!env.CAMMS_E2E_ADMIN_ID?.trim()) {
    errors.push('CAMMS_E2E_ADMIN_ID is required')
  }
  if (!env.CAMMS_E2E_ADMIN_PASSWORD?.trim()) {
    errors.push('CAMMS_E2E_ADMIN_PASSWORD is required')
  }

  return errors
}

export function getE2EInvocation(env: NodeJS.ProcessEnv) {
  if (!env.npm_execpath) throw new Error('npm_execpath is unavailable; run through npm run test:e2e:release')
  return {
    command: process.execPath,
    args: [env.npm_execpath, 'run', 'test:e2e'],
  }
}

async function main() {
  const errors = validateReleaseE2EEnv(process.env)
  if (errors.length > 0) {
    console.error(`Authenticated release E2E prerequisites failed:\n- ${errors.join('\n- ')}`)
    process.exitCode = 1
    return
  }

  const invocation = getE2EInvocation(process.env)
  const child = spawn(invocation.command, invocation.args, {
    env: process.env,
    stdio: 'inherit',
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => child.kill(signal))
  }

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (signal) {
        console.error(`Authenticated release E2E terminated by ${signal}`)
      }
      resolve(code ?? 1)
    })
  })

  process.exitCode = exitCode
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main()
}
