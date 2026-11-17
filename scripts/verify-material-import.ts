import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import assert from 'node:assert/strict'
import type { PostgresTransaction } from '../lib/postgres/db'
async function main() {
 const ownerConfig=parse(readFileSync('.env.postgres.app'))
 for (const key of ['DATABASE_MIGRATION_URL','DATABASE_URL']) assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(ownerConfig[key]).hostname), 'Only loopback PostgreSQL is allowed')
 mkdirSync('.cache',{recursive:true})
 const name='camms_material_test_'+Date.now().toString(36)
 assert.match(name,/^camms_material_test_[a-z0-9]+$/)
 const controller=new Pool({connectionString:ownerConfig.DATABASE_MIGRATION_URL,connectionTimeoutMillis:5000})
 const ownerUrl=new URL(ownerConfig.DATABASE_MIGRATION_URL); ownerUrl.pathname='/'+name
 const owner=new Pool({connectionString:ownerUrl.toString(),connectionTimeoutMillis:5000})
 const appUrl=new URL(ownerConfig.DATABASE_URL);appUrl.pathname='/'+name
 Object.assign(process.env,ownerConfig,{DATABASE_URL:appUrl.toString()})
 const app=new Pool({connectionString:appUrl.toString(),connectionTimeoutMillis:5000})
 let created=false
 try {
 await controller.query(`CREATE DATABASE "${name}"`);created=true
 await owner.query('BEGIN')
 await owner.query(readFileSync('db/postgres/migrations/0000_final_schema.sql','utf8'))
 await owner.query("insert into public.profiles(full_name,role,is_active) values ('Isolated material test admin','admin',true)")
 await owner.query('COMMIT')
 const client=await app.connect()
 const counts=async()=> (await owner.query('select (select count(*)::int from public.items) as items, (select count(*)::int from public.categories) as categories, (select count(*)::int from public.units) as units, (select count(*)::int from public.locations) as locations, (select count(*)::int from public.audit_logs) as audit_logs')).rows[0]
 const before=await counts()
 let inside:unknown
 try {
  const profile=(await owner.query("select * from public.profiles where role='admin' and is_active=true limit 1")).rows[0]
  assert.ok(profile,'Isolated fixture admin must exist')
  await client.query('BEGIN')
  await client.query("select set_config('app.user_id',$1,true)",[profile.id])
  const tx=drizzle(client) as unknown as PostgresTransaction
  const mock=(p:string,exports:unknown)=>{const filename=require.resolve(p);require.cache[filename]={id:filename,filename,loaded:true,exports} as NodeJS.Module}
  mock('../features/auth/queries',{getCurrentProfile:async()=>profile})
  mock('../lib/postgres/request',{withUserDatabase:async(callback:(tx:PostgresTransaction)=>unknown)=>{
    await client.query('SAVEPOINT material_service')
    try { const result=await callback(tx);await client.query('RELEASE SAVEPOINT material_service');return result }
    catch(error){await client.query('ROLLBACK TO SAVEPOINT material_service');await client.query('RELEASE SAVEPOINT material_service');throw error}
  }})
  const { importPostgresItems }=await import('../features/items/postgres-actions')
  const manifest=JSON.parse(readFileSync('docs/material-import-2570/materials-2570-manifest.json','utf8'))
  const rows=manifest.records
  const result=await importPostgresItems(rows)
  assert.equal(result.error,null,JSON.stringify(result.error))
  assert.equal(result.data?.count,76)
  inside=(await client.query("select count(*)::int as items, count(*) filter(where quantity=0)::int as zero, sum(quantity*unit_price)::numeric as value from public.items where note like '%[CAMMS-MATERIAL-2570:%'")).rows[0]
  assert.equal((inside as {items:number}).items,76)
  assert.equal((inside as {zero:number}).zero,42)
  assert.equal(Number((inside as {value:string}).value),38776)
  const repeat=await importPostgresItems(rows)
  assert.match(repeat.error?.message??'',/ซ้ำ/)
  const afterRepeat=(await client.query("select count(*)::int as n from public.items where note like '%[CAMMS-MATERIAL-2570:%'")).rows[0].n
  assert.equal(afterRepeat,76)
  const broken=await importPostgresItems([{...rows[0],item_name:'Valid first new row',note:'unique test row'}, {...rows[1],item_name:'x'.repeat(256),note:'unique invalid test row'}])
  assert.ok(broken.error)
  assert.equal((await client.query("select count(*)::int as n from public.items where item_name='Valid first new row'")).rows[0].n,0)
  console.log('PASS atomic rollback: late invalid row leaves no partial inventory')
  console.log('PASS actual import: 76 records, zero stock retained, value reconciled; repeated import rejected')
 } finally {
  await client.query('ROLLBACK')
  client.release()
  const after=await counts()
  assert.deepEqual(after,before,'Test database must be unchanged after rollback')
  writeFileSync('.cache/material-staging-result.json',JSON.stringify({mode:'disposable-database-rollback',before,inside,after,unchanged:true},null,2))
 }
 } finally {
  await Promise.allSettled([owner.end(),app.end()])
  try {if(created) await controller.query(`DROP DATABASE "${name}"`)} finally {await controller.end()}
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
