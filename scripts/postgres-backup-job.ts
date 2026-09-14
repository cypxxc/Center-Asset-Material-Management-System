import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, open, readFile, rename, unlink, writeFile, realpath } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

export function validateDestination(destination: string) {
  if (!path.isAbsolute(destination) || /[\r\n\0]/.test(destination)) throw new Error('Backup destination must be an absolute directory')
  const resolved = path.resolve(destination)
  if (resolved === path.parse(resolved).root) throw new Error('Use a dedicated backup directory, not a filesystem root')
  return resolved
}

type JobOptions = { destination: string; stateDir: string; attempts?: number; retryDelayMs?: number; timeoutMs?: number }
type JobStatus = { state: string; startedAt?: string; finishedAt?: string; lastSuccessAt?: string; attempt?: number; backup?: string; message?: string }

export async function backupAttempt(destination: string, timeoutMs: number, npmCli = process.env.npm_execpath ?? path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js')): Promise<string> {
  // Launch npm's JavaScript entrypoint directly: no shell interpolation of a NAS path.
  const completedPath = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [npmCli, 'run', 'backup:release', '--', destination], {
      cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, DATA_BACKEND: 'postgres' },
    })
    let output = ''
    let timedOut = false
    child.stdout.on('data', chunk => { output = (output + String(chunk)).slice(-65536) })
    const timer = setTimeout(() => {
      timedOut = true
      if (process.platform === 'win32' && child.pid) {
        spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 10000 })
      } else child.kill('SIGKILL')
    }, timeoutMs)
    child.once('error', () => { clearTimeout(timer); reject(new Error('Backup process could not start')) })
    child.once('close', code => {
      clearTimeout(timer)
      const completed = output.match(/^Full PostgreSQL backup completed: (.+)\r?$/m)?.[1]?.trim()
      if (timedOut || code !== 0 || !completed) reject(new Error('Backup process failed or timed out'))
      else resolve(completed)
    })
  })
  const root = await realpath(destination)
  const completed = await realpath(completedPath)
  if (path.dirname(completed) !== root || !path.basename(completed).startsWith('camms-postgres-')) throw new Error('Invalid completed backup path')
  const manifest = JSON.parse(await readFile(path.join(completed, 'manifest.json'), 'utf8'))
  if (manifest.format !== 'camms-postgres-full' || manifest.version !== 1 || !/^[a-f0-9]{64}$/.test(manifest.dumpSha256) || !Array.isArray(manifest.storageFiles)) {
    throw new Error('Backup completion manifest is invalid')
  }
  return completed
}

export async function runBackupJob(options: JobOptions, run: (destination: string, timeoutMs: number) => Promise<string> = backupAttempt): Promise<number> {
  const destination = validateDestination(options.destination)
  const attempts = options.attempts ?? 3
  const retryDelayMs = options.retryDelayMs ?? 60000
  const timeoutMs = options.timeoutMs ?? 600000
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3 || !Number.isFinite(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 60000 || !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 600000) throw new Error('Invalid backup job limits')
  await mkdir(options.stateDir, { recursive: true })
  const lockPath = path.join(options.stateDir, 'job.lock')
  const statusPath = path.join(options.stateDir, 'status.json')
  let lock
  try { lock = await open(lockPath, 'wx', 0o600) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    await writeFile(path.join(options.stateDir, 'last-blocked.json'), JSON.stringify({ state: 'blocked', at: new Date().toISOString(), message: 'Existing job lock; inspect owner before removing.' }), { mode: 0o600 })
    // Never remove or overwrite another job's lock/status. Task Scheduler reports exit 2.
    console.error('Backup blocked: another job or an interrupted-job lock exists. Inspect job.lock and status.json.')
    return 2
  }
  let status: JobStatus = { state: 'running', startedAt: new Date().toISOString() }
  const save = async () => {
    const temporary = path.join(options.stateDir, `status-${process.pid}.tmp`)
    await writeFile(temporary, JSON.stringify(status, null, 2), { mode: 0o600 })
    await rename(temporary, statusPath)
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: status.startedAt }))
    try {
      const previous = JSON.parse(await readFile(statusPath, 'utf8')) as JobStatus
      status.lastSuccessAt = previous.lastSuccessAt
    } catch { /* First run or unreadable old status: report this run independently. */ }
    for (let attempt = 1; attempt <= attempts; attempt++) {
      status = { ...status, state: 'running', attempt }
      await save()
      try {
        const backup = await run(destination, timeoutMs)
        const finishedAt = new Date().toISOString()
        status = { ...status, state: 'succeeded', finishedAt, lastSuccessAt: finishedAt, backup, message: undefined }
        await save()
        console.log('PostgreSQL backup completed. See local status.json for the verified backup path.')
        return 0
      } catch {
        // Never persist raw subprocess/database errors: they may contain credentials.
        status = { ...status, state: attempt === attempts ? 'failed' : 'retrying', message: 'Backup failed or timed out; inspect Docker, destination permissions and available space.' }
        if (attempt === attempts) status.finishedAt = new Date().toISOString()
        await save()
        if (attempt < attempts) await delay(retryDelayMs)
      }
    }
    console.error('PostgreSQL backup failed after bounded retries. See local status.json.')
    return 1
  } finally {
    await lock.close()
    await unlink(lockPath)
  }
}

async function main() {
  const configPath = process.argv[2]
  if (!configPath || !path.isAbsolute(configPath)) throw new Error('Usage: node --import tsx scripts/postgres-backup-job.ts <absolute-config.json>')
  const config = JSON.parse(await readFile(configPath, 'utf8')) as { destination: string }
  process.exitCode = await runBackupJob({ destination: config.destination, stateDir: path.resolve('.cache/postgres-backup-job') })
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Backup job could not run. Check configuration and local state directory permissions.'); process.exitCode = 1 })
}
