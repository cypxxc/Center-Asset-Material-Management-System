import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'

async function main() {
  const base = process.env.POSTGRES_HTTP_URL || 'http://127.0.0.1:3000'
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Only a local verification server is allowed')
  const app = parse(readFileSync('.env.postgres.app'))
  const initial = parse(readFileSync('.env.postgres.admin'))
  const owner = new Pool({connectionString:app.DATABASE_MIGRATION_URL,connectionTimeoutMillis:5000})
  owner.on('error', () => {})
  const token = randomBytes(32).toString('hex')
  const hash = createHash('sha256').update(token).digest('hex')
  const manifest = JSON.parse(readFileSync(process.env.POSTGRES_ACTION_MANIFEST || '.next/server/server-reference-manifest.json','utf8')) as {node: Record<string,{exportedName?:string}>}
  const action = Object.entries(manifest.node).find(([,v])=>v.exportedName==='importDatabaseData')?.[0]
  assert.ok(action, 'Production import action must exist')
  try {
    const profile = await owner.query('select id from public.profiles where email=$1 and is_active and role=$2',[initial.INITIAL_ADMIN_EMAIL,'admin'])
    assert.equal(profile.rowCount,1)
    await owner.query("insert into private_auth.sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '5 minutes')",[hash,profile.rows[0].id])
    for (const [label,input,expected] of [
      ['1.2 MB passes transport', 'x'.repeat(1_200_000), /not valid JSON|Unexpected token/],
      ['25 MiB reaches business validation', 'x'.repeat(25*1024*1024), /not valid JSON|Unexpected token/],
      ['Over 25 MiB is rejected by business validation', 'x'.repeat(25*1024*1024+1), /Maximum size is 25 MB/],
      ['UTF-8 bytes enforce limit for Thai text', 'ก'.repeat(9*1024*1024), /Maximum size is 25 MB/],
    ] as const) {
      // These are deliberately invalid JSON documents, so no restore can modify data.
      const response: Response = await fetch(base+'/dashboard',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(60000),
        headers:{Cookie:`camms_session=${token}`,Origin:base,'Next-Action':action,'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify([input])})
      assert.equal(response.status,200,`${label}: transport failed with ${response.status}`)
      assert.match(await response.text(),expected,label)
      console.log(`PASS: ${label}`)
    }
  } finally {
    await owner.query('delete from private_auth.sessions where token_hash=$1',[hash])
    await owner.end()
  }
}
main().catch(error=>{console.error(error instanceof Error ? error.message : 'Payload verification failed');process.exitCode=1})
