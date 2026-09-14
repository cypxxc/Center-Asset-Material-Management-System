import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'

async function main() {
  const base = process.env.POSTGRES_HTTP_URL || 'http://127.0.0.1:3000'
  assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname), 'Load verification targets only a local server')
  const concurrency = Number(process.env.POSTGRES_LOAD_USERS || 20)
  assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 50, 'Set 1–50 concurrent clients')
  const app = parse(readFileSync('.env.postgres.app'))
  const admin = parse(readFileSync('.env.postgres.admin'))
  const owner = new Pool({connectionString:app.DATABASE_MIGRATION_URL,connectionTimeoutMillis:5000})
  const marker = `Load-${randomUUID()}`
  const tokens = Array.from({length:concurrency},()=>randomBytes(32).toString('hex'))
  const hashes = tokens.map(token=>createHash('sha256').update(token).digest('hex'))
  const streams: AbortController[] = []
  const times: number[] = []
  const failures: string[] = []
  const paths = ['/dashboard','/items','/reports','/locations','/settings']
  let started = 0
  try {
    const result = await owner.query('select id from public.profiles where email=$1 and role=$2 and is_active',[admin.INITIAL_ADMIN_EMAIL,'admin'])
    assert.equal(result.rowCount,1)
    const id = result.rows[0].id
    await owner.query("insert into private_auth.sessions(token_hash,user_id,expires_at) select unnest($1::text[]),$2,now()+interval '10 minutes'",[hashes,id])
    // Representative data stays bounded and is removed by this unique marker only.
    await owner.query("insert into public.items(item_name,item_type,quantity,unit_price,created_by,updated_by) select $1||'-'||n,'asset',n%10+1,125.50,$2,$2 from generate_series(1,1000) n",[marker,id])
    for (const path of paths) {
      const response = await fetch(base+path,{headers:{Cookie:`camms_session=${tokens[0]}`},redirect:'manual',signal:AbortSignal.timeout(30000)})
      assert.equal(response.status,200,`Warmup ${path}`)
      await response.arrayBuffer()
    }
    await Promise.all(tokens.map(async token=>{
      const controller = new AbortController(); streams.push(controller)
      const response = await fetch(base+'/api/events?tables=items',{headers:{Cookie:`camms_session=${token}`},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(120000)])})
      assert.equal(response.status,200,'Concurrent SSE connection')
      // Discard frames while preserving active connections during the workload.
      void response.body?.pipeTo(new WritableStream({write(){}})).catch(()=>{})
    }))
    started = performance.now()
    await Promise.all(tokens.map(async (token,worker)=>{
      for (let n=0;n<10;n++) {
        const path=paths[(worker+n)%paths.length]
        const start=performance.now()
        try {
          const response=await fetch(base+path,{headers:{Cookie:`camms_session=${token}`},redirect:'manual',signal:AbortSignal.timeout(30000)})
          const body=await response.text()
          if(response.status!==200 || /Application error: a server-side exception/.test(body)) failures.push(`${path}: ${response.status}`)
        } catch(error) { failures.push(`${path}: ${error instanceof Error ? error.name : 'request failed'}`) }
        times.push(performance.now()-start)
      }
    }))
    const elapsed=performance.now()-started
    const sorted=times.toSorted((a,b)=>a-b)
    const percentile=(p:number)=>Math.round(sorted[Math.ceil(sorted.length*p)-1])
    const report={date:new Date().toISOString(),concurrentClients:concurrency,activeEventStreams:concurrency,fixtureItems:1000,requests:times.length,errors:failures.length,p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),maxMs:Math.round(sorted.at(-1)!),requestsPerSecond:Number((times.length/(elapsed/1000)).toFixed(2)),criteria:{errors:0,p95Ms:5000},passed:failures.length===0 && percentile(.95)<=5000}
    mkdirSync('.cache/postgres',{recursive:true})
    writeFileSync('.cache/postgres/load-result.json',JSON.stringify(report,null,2))
    console.log(JSON.stringify(report,null,2))
    assert.equal(failures.length,0,failures.slice(0,5).join('; '))
    assert.ok(report.passed,'p95 exceeds the provisional 5-second release target')
  } finally {
    streams.forEach(controller=>controller.abort())
    await owner.query("delete from public.items where item_name like $1",[marker+'-%'])
    await owner.query("delete from public.audit_logs where old_data->>'item_name' like $1 or new_data->>'item_name' like $1",[marker+'-%'])
    await owner.query('delete from private_auth.sessions where token_hash=any($1::text[])',[hashes])
    await owner.end()
  }
}
main().catch(error=>{console.error(error instanceof Error ? error.message : 'Load verification failed');process.exitCode=1})
