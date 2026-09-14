import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { backupAttempt, runBackupJob, validateDestination } from './postgres-backup-job'

async function cleanupTestDirectory(directory: string) {
  assert.equal(path.dirname(directory), path.resolve(tmpdir()))
  assert.ok(path.basename(directory).startsWith('camms-job-test-'))
  await rm(directory, { recursive: true, force: true })
}

test('backup destination must be an absolute directory, never a filesystem root', () => {
  assert.throws(() => validateDestination('relative'))
  assert.throws(() => validateDestination(path.parse(process.cwd()).root))
  assert.equal(validateDestination(path.join(tmpdir(), 'camms-backups')), path.resolve(tmpdir(), 'camms-backups'))
})

test('job retries failures, preserves last success on failure, and suppresses child secrets', async () => {
  const stateDir = await mkdtemp(path.join(tmpdir(), 'camms-job-test-'))
  try {
    const destination = path.join(stateDir, 'backups')
    let calls = 0
    const run = async () => { calls++; if (calls < 3) throw new Error('postgres://secret'); return 'verified-backup' }
    assert.equal(await runBackupJob({ destination, stateDir, attempts: 3, retryDelayMs: 0 }, run), 0)
    const success = JSON.parse(await readFile(path.join(stateDir, 'status.json'), 'utf8'))
    assert.equal(success.state, 'succeeded')
    assert.equal(calls, 3)
    assert.ok(success.lastSuccessAt)
    assert.equal(await runBackupJob({ destination, stateDir, attempts: 2, retryDelayMs: 0 }, async () => { throw new Error('postgres://secret') }), 1)
    const raw = await readFile(path.join(stateDir, 'status.json'), 'utf8')
    assert.ok(!raw.includes('secret'))
    const failure = JSON.parse(raw)
    assert.equal(failure.lastSuccessAt, success.lastSuccessAt)
    assert.equal(failure.state, 'failed')
  } finally { await cleanupTestDirectory(stateDir) }
})

test('existing lock refuses overlapping or interrupted jobs without removing their lock', async () => {
  const stateDir = await mkdtemp(path.join(tmpdir(), 'camms-job-test-'))
  try {
    await writeFile(path.join(stateDir, 'job.lock'), 'existing-owner')
    let called = false
    assert.equal(await runBackupJob({ destination: path.join(stateDir, 'backups'), stateDir }, async () => { called = true; return '' }), 2)
    assert.equal(called, false)
    assert.equal(await readFile(path.join(stateDir, 'job.lock'), 'utf8'), 'existing-owner')
    assert.equal(JSON.parse(await readFile(path.join(stateDir, 'last-blocked.json'), 'utf8')).state, 'blocked')
  } finally { await cleanupTestDirectory(stateDir) }
})

test('a stuck backup subprocess is killed within the configured timeout without leaking its output', async () => {
  const stateDir = await mkdtemp(path.join(tmpdir(), 'camms-job-test-'))
  try {
    const command = path.join(stateDir, 'stuck.cjs')
    await writeFile(command, "console.log('postgres://secret'); setInterval(() => {}, 1000)")
    const started = Date.now()
    await assert.rejects(backupAttempt(path.join(stateDir, 'backups'), 200, command), { message: 'Backup process failed or timed out' })
    assert.ok(Date.now() - started < 15000)
  } finally { await cleanupTestDirectory(stateDir) }
})
