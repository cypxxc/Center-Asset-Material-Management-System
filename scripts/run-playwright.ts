import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const project = process.argv[2]

export function getPlaywrightInvocation(projectName: string) {
  return {
    command: process.execPath,
    args: ['node_modules/@playwright/test/cli.js', 'test', `--project=${projectName}`],
  }
}

export async function settleWithin(promise: Promise<unknown>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise<false>((resolve) => {
        timeout = setTimeout(() => resolve(false), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function waitForExit(child: ChildProcess) {
  return new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
}

async function waitForServer(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.status > 0) return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error(`Server did not become ready at ${url} within ${timeoutMs}ms`)
}

function stopServerTree(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null) return

  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      timeout: 5_000,
    })
    return
  }

  process.kill(-child.pid, 'SIGTERM')
}

async function main() {
  if (!project) throw new Error('Playwright project name is required')

  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start'], {
    env: process.env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  })

  try {
    await waitForServer('http://localhost:3000', 120_000)
    const invocation = getPlaywrightInvocation(project)
    const runner = spawn(invocation.command, invocation.args, {
      env: { ...process.env, PLAYWRIGHT_EXTERNAL_SERVER: 'true' },
      stdio: 'inherit',
    })
    return await waitForExit(runner)
  } finally {
    stopServerTree(server)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main()
    .then((exitCode) => process.exit(exitCode))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}
