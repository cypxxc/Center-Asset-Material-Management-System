import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { parse } from 'dotenv'
import { Pool } from 'pg'

// Explicit opt-in: verifies a running local app; removes only its own fixture rows/files.
async function main() {
  if (process.env.POSTGRES_HTTP_INTEGRATION !== '1') throw new Error('Set POSTGRES_HTTP_INTEGRATION=1 to run this local HTTP check')
  const app = parse(readFileSync('.env.postgres.app'))
  const initial = parse(readFileSync('.env.postgres.admin'))
  const base = process.env.POSTGRES_HTTP_URL || 'http://127.0.0.1:3000'
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Only local app verification is supported')
  const owner = new Pool({ connectionString: app.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
  const runtime = new Pool({ connectionString: app.DATABASE_URL, connectionTimeoutMillis: 5000 })
  const token = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(token).digest('hex')
  const itemId = randomUUID()
  const fileId = randomUUID()
  const streamAbort = new AbortController()
  let filePath: string | undefined
  let streamTask: Promise<void> | undefined
  try {
    const admin = await owner.query("select id from public.profiles where email=$1 and role='admin' and is_active", [initial.INITIAL_ADMIN_EMAIL])
    assert.equal(admin.rowCount, 1)
    const userId: string = admin.rows[0].id
    await owner.query("insert into private_auth.sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '10 minutes')", [hash, userId])
    const url = `/api/files/item-images/${userId}/${fileId}.png`
    const directory = resolve(app.LOCAL_STORAGE_PATH, 'item-images', userId)
    filePath = resolve(directory, `${fileId}.png`)
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lGAAAAAASUVORK5CYII=', 'base64')
    await mkdir(directory, { recursive: true })
    await writeFile(filePath, png, { flag: 'wx', mode: 0o600 })
    const client = await runtime.connect()
    async function mutate(statement: string, values: unknown[], commit = true) {
      await client.query('begin')
      try {
        await client.query("select set_config('app.user_id',$1,true)", [userId])
        await client.query(statement, values)
        await client.query(commit ? 'commit' : 'rollback')
      } catch (error) { await client.query('rollback'); throw error }
    }
    try {
      await mutate("insert into public.items(id,item_name,item_type,quantity,image_url,created_by,updated_by) values($1,$2,'asset',1,$3,$4,$4)", [itemId, `HTTP verification ${itemId}`, url, userId])
      const request = (path: string, authenticated = true) => fetch(base + path, {
        headers: authenticated ? { Cookie: `camms_session=${token}` } : {}, redirect: 'manual', signal: AbortSignal.timeout(60000),
      })
      const anonymous = await request(url, false)
      assert.ok([401,403,404].includes(anonymous.status), `Anonymous image unexpectedly returned ${anonymous.status}`)
      const image = await request(url)
      assert.equal(image.status, 200)
      assert.equal(image.headers.get('content-type'), 'image/png')
      assert.equal(image.headers.get('cache-control'), 'private, no-store')
      assert.equal(image.headers.get('x-content-type-options'), 'nosniff')
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), png)
      const traversal = await request('/api/files/item-images/%2e%2e%2f%2e%2e%2f.env.postgres.app')
      assert.ok([400,403,404].includes(traversal.status))
      assert.equal((await request('/api/events?tables=items', false)).status, 401)
      console.log('PASS: private PNG bytes/headers, anonymous denial, traversal denial, SSE authentication')

      const events: string[] = []
      let closed = false
      const response = await fetch(base + '/api/events?tables=items', { headers: { Cookie: `camms_session=${token}` }, signal: streamAbort.signal })
      assert.equal(response.status, 200)
      assert.match(response.headers.get('content-type') || '', /text\/event-stream/)
      streamTask = (async () => {
        const reader = response.body!.getReader()
        const decoder = new TextDecoder()
        let pending = ''
        try {
          for (;;) {
            const chunk = await reader.read()
            if (chunk.done) break
            pending += decoder.decode(chunk.value, { stream: true })
            let boundary: number
            while ((boundary = pending.indexOf('\n\n')) !== -1) {
              const frame = pending.slice(0, boundary)
              pending = pending.slice(boundary + 2)
              if (frame.startsWith('data: ')) events.push(frame.slice(6))
            }
          }
        } finally { closed = true; reader.releaseLock() }
      })()
      async function waitFor(predicate: () => boolean, timeout = 5000) {
        const start = Date.now()
        while (!predicate() && Date.now() - start < timeout) await delay(25)
        assert.ok(predicate(), 'Timed out waiting for expected SSE state')
      }
      await waitFor(() => events.includes('reconnect'))
      const beforeCommit = events.filter(event => event === 'items').length
      await mutate('update public.items set quantity=2 where id=$1', [itemId])
      await waitFor(() => events.filter(event => event === 'items').length > beforeCommit)
      const beforeRollback = events.filter(event => event === 'items').length
      await mutate('update public.items set quantity=3 where id=$1', [itemId], false)
      await delay(1200)
      assert.equal(events.filter(event => event === 'items').length, beforeRollback, 'Rolled back update must not notify')
      assert.equal((await owner.query('select quantity from public.items where id=$1', [itemId])).rows[0].quantity, 2)
      console.log('PASS: committed item update emits invalidation; rolled-back update emits none')
      const revokedAt = Date.now()
      await owner.query('delete from private_auth.sessions where token_hash=$1', [hash])
      await waitFor(() => closed, 17000)
      await streamTask
      assert.ok([401,403,404].includes((await request(url)).status))
      assert.equal((await request('/api/events?tables=items')).status, 401)
      console.log(`PASS: revoked session closes SSE in ${Date.now() - revokedAt}ms and loses image/event access`)
    } finally { client.release() }
  } finally {
    streamAbort.abort()
    await streamTask?.catch(() => {})
    await owner.query('delete from private_auth.sessions where token_hash=$1', [hash])
    await owner.query('delete from public.items where id=$1', [itemId])
    await owner.query("delete from public.audit_logs where target_table='items' and target_id=$1", [itemId])
    if (filePath) await unlink(filePath).catch(error => { if (error.code !== 'ENOENT') throw error })
    await Promise.all([owner.end(), runtime.end()])
  }
  console.log('PASS: all HTTP verification fixtures removed')
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'HTTP verification failed'); process.exitCode = 1 })
