import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

// Local synthetic PostgreSQL only. Never connects to or seeds a remote database.
async function main() {
  const db = new PGlite()
  try {
    await db.exec(readFileSync('tests/fixtures/performance-rls.sql', 'utf8'))
    await db.exec(`INSERT INTO items SELECT n, 'item ' || n, NULL FROM generate_series(1, 20000) n; ANALYZE items`)
    const measure = async () => {
      await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='00000000-0000-0000-0000-000000000003'`)
      const samples: number[] = []
      let lastPlan: unknown
      for (let i = 0; i < 8; i++) {
        const result = await db.query<{ 'QUERY PLAN': Array<{ 'Execution Time': number }> }>('EXPLAIN (ANALYZE, FORMAT JSON) SELECT count(*) FROM items WHERE deleted_at IS NULL')
        lastPlan = result.rows[0]['QUERY PLAN']
        if (i > 0) samples.push(result.rows[0]['QUERY PLAN'][0]['Execution Time'])
      }
      await db.exec('RESET ROLE')
      return { samplesMs: samples, medianMs: [...samples].sort((a,b) => a-b)[3], plan: lastPlan }
    }
    const before = await measure()
    await db.exec(readFileSync('db/migrations/20260910083125_statement_scoped_rls_role.sql', 'utf8'))
    const after = await measure()
    console.log(JSON.stringify({ environment: 'local PGlite, synthetic 20000 rows, active viewer, 1 warmup + 7 samples', before, after }, null, 2))
  } finally { await db.close() }
}
void main()
