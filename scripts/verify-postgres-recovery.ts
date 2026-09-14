import assert from 'node:assert/strict'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { readFileSync, openSync, closeSync } from 'node:fs'
import { mkdir, cp, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { chromium } from '@playwright/test'
import { backupPostgres, storageInventory } from './backup-postgres'
import { hashPassword, verifyPassword } from '../lib/postgres/password'
import { withoutSupabase } from './postgres-local-config'

// Never restores over the source: both databases and all files are freshly allocated.
async function main() {
  assert.equal(process.env.POSTGRES_RECOVERY_INTEGRATION, '1', 'Set POSTGRES_RECOVERY_INTEGRATION=1 to run the isolated full recovery drill')
  const app = parse(readFileSync('.env.postgres.app'))
  const local = parse(readFileSync('.env.postgres.local'))
  const suffix = randomUUID().replaceAll('-', '')
  const names = [`camms_recovery_${suffix}_seed`, `camms_recovery_${suffix}_restored`]
  const root = path.resolve('.cache/postgres', `recovery-${suffix}`)
  assert.equal(path.dirname(root), path.resolve('.cache/postgres'))
  const owner = new Pool({ connectionString: app.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
  const pools: Pool[] = []
  const created: string[] = []
  let server: ChildProcess | undefined
  const connection = (url: string, name: string) => { const parsed = new URL(url); parsed.pathname = `/${name}`; return parsed.toString() }
  const env: NodeJS.ProcessEnv = { ...withoutSupabase(process.env), NODE_ENV:'production' }
  const container = spawnSync('docker', ['compose','--env-file','.env.postgres.local','-f','compose.postgres.yaml','ps','-q','postgres'], { env, encoding:'utf8',timeout:15000 })
  const id = container.stdout?.trim()
  assert.equal(container.status, 0)
  assert.match(id, /^[a-f0-9]{12,64}$/)
  async function restore(backup: string, name: string, storage: string) {
    assert.match(name, /^camms_recovery_[a-f0-9]{32}_(seed|restored)$/)
    assert.notEqual(name, new URL(app.DATABASE_MIGRATION_URL).pathname.slice(1))
    const manifest = JSON.parse(readFileSync(path.join(backup,'manifest.json'),'utf8'))
    assert.equal(manifest.dumpSha256, createHash('sha256').update(readFileSync(path.join(backup,'database.dump'))).digest('hex'))
    assert.deepEqual(await storageInventory(path.join(backup,'storage')), manifest.storageFiles)
    await owner.query(`create database "${name}"`)
    created.push(name)
    const fd = openSync(path.join(backup,'database.dump'),'r')
    try {
      const restored = spawnSync('docker',['exec','-i',id,'pg_restore','-U',local.POSTGRES_USER,'-d',name,'--exit-on-error','--single-transaction'], { env,stdio:[fd,'pipe','pipe'],timeout:120000 })
      assert.equal(restored.status,0,'pg_restore must complete without errors')
    } finally { closeSync(fd) }
    await cp(path.join(backup,'storage'),storage,{recursive:true,errorOnExist:true,force:false})
    assert.deepEqual(await storageInventory(storage),manifest.storageFiles)
    const pool = new Pool({connectionString:connection(app.DATABASE_MIGRATION_URL,name),connectionTimeoutMillis:5000})
    pools.push(pool)
    return pool
  }
  try {
    await mkdir(root,{recursive:true})
    const initial = await backupPostgres(path.join(root,'backups'))
    const seedStorage = path.join(root,'seed-storage')
    const seed = await restore(initial,names[0],seedStorage)
    const actor = randomUUID(), item = randomUUID(), file = randomUUID()
    const email = `recovery-${suffix}@example.com`, password = randomBytes(24).toString('hex')
    const encoded = await hashPassword(password)
    const imageUrl = `/api/files/item-images/${actor}/${file}.png`
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6lGAAAAAASUVORK5CYII=','base64')
    await seed.query("insert into public.profiles(id,email,full_name,role) values($1,$2,'Recovery drill','admin')",[actor,email])
    await seed.query('insert into private_auth.credentials(user_id,password_hash) values($1,$2)',[actor,encoded])
    await seed.query("insert into private_auth.sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')",[suffix,actor])
    await seed.query("insert into public.items(id,item_name,item_type,quantity,image_url,created_by) values($1,'Recovery drill item','asset',7,$2,$3)",[item,imageUrl,actor])
    await mkdir(path.join(seedStorage,'item-images',actor),{recursive:true})
    await writeFile(path.join(seedStorage,'item-images',actor,`${file}.png`),png,{flag:'wx',mode:0o600})
    const backup = await backupPostgres(path.join(root,'backups'),{migrationUrl:connection(app.DATABASE_MIGRATION_URL,names[0]),storagePath:seedStorage})
    const restoredStorage = path.join(root,'restored-storage')
    const restored = await restore(backup,names[1],restoredStorage)
    const tables = await seed.query("select schemaname,tablename from pg_tables where schemaname in ('public','private_auth','drizzle') order by schemaname,tablename")
    for (const table of tables.rows) {
      const identifier = `"${String(table.schemaname).replaceAll('"','""')}"."${String(table.tablename).replaceAll('"','""')}"`
      const query = `select to_jsonb(t) as row from ${identifier} t order by to_jsonb(t)::text`
      // Compare without allowing an assertion diff to expose restored user data.
      assert.ok(JSON.stringify((await restored.query(query)).rows)===JSON.stringify((await seed.query(query)).rows),`${identifier} rows must survive full restore`)
    }
    assert.equal(await verifyPassword(password,(await restored.query('select password_hash from private_auth.credentials where user_id=$1',[actor])).rows[0].password_hash),true)
    assert.equal((await restored.query('select token_hash from private_auth.sessions where token_hash=$1',[suffix])).rowCount,1)
    await restored.query('delete from private_auth.sessions')
    assert.equal((await restored.query('select count(*)::int n from private_auth.sessions')).rows[0].n,0)
    console.log(`PASS: pg_dump/pg_restore, all ${tables.rowCount} tables exact, private storage SHA-256, password hashes, restored session purge`)
    const port = Number(process.env.POSTGRES_RECOVERY_PORT ?? 3107)
    assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535 && port !== 3000)
    const base = `http://127.0.0.1:${port}`
    const serverEnv: NodeJS.ProcessEnv = { ...env, ...app, NODE_ENV:'production', DATA_BACKEND:'postgres', DATABASE_URL:connection(app.DATABASE_URL,names[1]),DATABASE_AUTH_URL:connection(app.DATABASE_AUTH_URL,names[1]),DATABASE_MIGRATION_URL:connection(app.DATABASE_MIGRATION_URL,names[1]),LOCAL_STORAGE_PATH:restoredStorage }
    server = spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env:serverEnv,stdio:'ignore',windowsHide:true})
    let ready = false
    for(let attempt=0;attempt<90;attempt++) {
      assert.equal(server.exitCode,null,'Isolated web server exited before readiness')
      try { ready = (await fetch(`${base}/login`,{signal:AbortSignal.timeout(1000)})).ok } catch {}
      if(ready) break
      await delay(500)
    }
    assert.ok(ready,'Isolated web server did not start')
    const browser = await chromium.launch({headless:true})
    try {
      const context = await browser.newContext()
      const page = await context.newPage()
      await page.goto(`${base}/login`)
      await page.locator('input[name=id]').fill(email)
      await page.locator('input[name=password]').fill(password)
      await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click()
      await page.waitForURL('**/dashboard',{timeout:60000})
      assert.equal((await restored.query('select count(*)::int n from private_auth.sessions where user_id=$1',[actor])).rows[0].n,1,'Browser must create its session in restored DB')
      // Chromium treats loopback as trustworthy for Secure cookies; its API
      // request client does not. Read through the actual logged-in browser.
      const image = await page.evaluate(async url => { const response=await fetch(url);return {status:response.status,bytes:Array.from(new Uint8Array(await response.arrayBuffer()))} },imageUrl)
      assert.equal(image.status,200)
      assert.deepEqual(Buffer.from(image.bytes),png)
      const anonymous = await browser.newContext()
      assert.ok([401,403,404].includes((await anonymous.request.get(base+imageUrl)).status()))
      await anonymous.close()
      await page.goto(`${base}/items/${item}`)
      assert.match(await page.locator('main').innerText(),/Recovery drill item/)
      console.log('PASS: restored production web login creates a new session, restored item renders, private image bytes match, anonymous image denied')
    } finally { await browser.close() }
  } finally {
    if(server && server.exitCode === null) { const exit=once(server,'exit');server.kill();await exit }
    await Promise.all(pools.map(pool=>pool.end()))
    for(const name of created.reverse()) {
      assert.match(name,/^camms_recovery_[a-f0-9]{32}_(seed|restored)$/)
      assert.ok(names.includes(name))
      await owner.query(`drop database "${name}" with (force)`)
    }
    await owner.end()
    assert.equal(path.dirname(root),path.resolve('.cache/postgres'))
    assert.equal(path.basename(root),`recovery-${suffix}`)
    await rm(root,{recursive:true,force:true})
  }
  console.log('PASS: isolated recovery databases, backup copies, private files and secondary server removed; source data unchanged')
}
main().catch(error=>{console.error(error instanceof Error ? error.message : 'Recovery verification failed');process.exitCode=1})
