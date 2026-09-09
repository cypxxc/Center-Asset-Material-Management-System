import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

test('database limiter counts queued calls, enforces grants and expires windows', async () => {
  const db = new PGlite()
  try {
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;')
    await db.exec(readFileSync('db/migrations/20260909012737_shared_rate_limits.sql', 'utf8'))
    const consume = (key: string, limit = 5) => db.query<{ result: { success: boolean; remaining: number } }>(
      'SELECT public.consume_rate_limit($1, $2, 60000) AS result', [key, limit])
    await db.exec('SET ROLE service_role')
    const key = 'a'.repeat(64)
    const results = await Promise.all(Array.from({ length: 30 }, () => consume(key)))
    assert.equal(results.filter(r => r.rows[0].result.success).length, 5)
    assert.equal(results[29].rows[0].result.remaining, 0)
    assert.equal((await consume('b'.repeat(64))).rows[0].result.success, true)
    await db.exec("UPDATE public.request_rate_limits SET expires_at = clock_timestamp() - interval '1 second'")
    assert.equal((await consume(key)).rows[0].result.success, true)
    await assert.rejects(consume('invalid'))
    await assert.rejects(consume(key, 0))
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`RESET ROLE; SET ROLE ${role}`)
      await assert.rejects(consume(key), /permission denied/)
      await assert.rejects(db.query('SELECT * FROM public.request_rate_limits'), /permission denied/)
    }
    await db.exec('RESET ROLE')
    const flags = await db.query<{ relrowsecurity: boolean }>("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.request_rate_limits'::regclass")
    assert.equal(flags.rows[0].relrowsecurity, true)
  } finally {
    await db.close()
  }
})
