import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { parse } from 'dotenv'
import { localPostgresConfig } from '../../scripts/postgres-local-config'
import { drizzle } from 'drizzle-orm/node-postgres'

test('material separation preserves UUIDs, history, RLS and physical stock ownership', {
  skip: process.env.MATERIAL_MIGRATION_TEST !== '1',
}, async () => {
  const config = localPostgresConfig(parse(readFileSync('.env.postgres.local')))
  const owner = new Pool({ connectionString: config.connectionString })
  const name = `camms_material_test_${randomUUID().replaceAll('-', '')}`
  await owner.query(`create database "${name}"`)
  const url = new URL(config.connectionString); url.pathname = `/${name}`
  const pool = new Pool({ connectionString: url.toString() })
  const client = await pool.connect()
  try {
    const migrations = readdirSync('db/postgres/migrations').filter(file => file.endsWith('.sql')).sort()
    for (const file of migrations.filter(file => file < '0005')) await client.query(readFileSync(`db/postgres/migrations/${file}`, 'utf8'))
    const admin = randomUUID(), user = randomUUID(), material = randomUUID(), asset = randomUUID()
    await client.query(`insert into public.profiles (id,full_name,role) values ($1,'Admin','admin'),($2,'User','user')`, [admin,user])
    await client.query(`insert into public.items(id,item_name,item_type,quantity) values ($1,'Paper','material',12),($2,'Desk','asset',1)`, [material,asset])
    await client.query(`insert into public.stock_movements(item_id,delta,balance_after,movement_type) values($1,0,12,'adjust_audit')`, [material])
    await client.query('begin')
    await client.query(readFileSync('db/postgres/migrations/0005_separate_materials.sql', 'utf8'))
    await client.query('commit')
    assert.equal((await client.query('select count(*)::int as n from public.items')).rows[0].n, 1)
    assert.equal((await client.query('select quantity from public.materials where id=$1', [material])).rows[0].quantity, 12)
    assert.equal((await client.query('select count(*)::int as n from public.inventory_items')).rows[0].n, 2)
    assert.equal((await client.query('select item_id from public.stock_movements')).rows[0].item_id, material)
    await client.query('begin; set local role camms_app')
    await client.query(`select set_config('app.user_id',$1,true)`, [user])
    assert.equal((await client.query('select count(*)::int as n from public.inventory_items')).rows[0].n, 2)
    await assert.rejects(client.query(`insert into public.materials(item_name,item_type) values('Forbidden','material')`))
    await client.query('rollback')
    await client.query('begin; set local role camms_app')
    await client.query(`select set_config('app.user_id',$1,true)`, [admin])
    const inserted = (await client.query(`insert into public.materials(item_name,item_type,quantity,specification,commodity_code) values('New','material',0,'80 gsm','14111500') returning id`)).rows[0].id
    assert.equal((await client.query('select item_type from public.inventory_registry where id=$1',[inserted])).rows[0].item_type,'material')
    await client.query('commit')
    await assert.rejects(client.query('delete from public.materials where id=$1', [material]), /foreign key/)
    assert.equal((await client.query('select quantity from public.materials where id=$1',[material])).rows[0].quantity,12)
    for (const file of migrations.filter(file => file > '0005_separate_materials.sql')) {
      await client.query(readFileSync(`db/postgres/migrations/${file}`, 'utf8'))
    }
    // Exercise the actual application issue/reversal paths on this disposable database.
    for (const moduleName of ['server-only','next/cache']) {
      const filename = require.resolve(moduleName)
      require.cache[filename] = { id: filename, filename, loaded: true, exports: moduleName === 'next/cache' ? { revalidatePath: () => {}, revalidateTag: () => {} } : {} } as NodeJS.Module
    }
    const requestFile = require.resolve('../../lib/postgres/request')
    require.cache[requestFile] = { id: requestFile, filename: requestFile, loaded: true,
      exports: { withUserDatabase: (callback: (tx: unknown) => Promise<unknown>) => callback(drizzle(client)) } } as NodeJS.Module
    const authFile = require.resolve('../../features/auth/queries')
    require.cache[authFile] = { id: authFile, filename: authFile, loaded: true,
      exports: { getCurrentProfile: async () => ({ id: admin, role: 'admin', is_active: true }) } } as NodeJS.Module
    const actions = await import('../../features/disbursements/postgres-actions')
    await client.query('begin; set local role camms_app')
    await client.query(`select set_config('app.user_id',$1,true)`, [admin])
    await client.query('update public.materials set is_central=true where id=$1',[material])
    const draft = await actions.createPostgresDisbursementDraft({ transaction_type:'material_issue', recipient_name:'Tester', department_name:'Test',purpose:'Isolation check',items:[{item_id:material,requested_qty:3}] })
    await actions.confirmPostgresDisbursement(draft.id)
    assert.equal((await client.query('select quantity from public.materials where id=$1',[material])).rows[0].quantity,9)
    await actions.reversePostgresDisbursement({ disbursement_id:draft.id, reason:'Test reversal' })
    assert.equal((await client.query('select quantity from public.materials where id=$1',[material])).rows[0].quantity,12)
    const { materialLedgerSchema } = await import('../../features/items/material-fields')
    const { importPostgresItems } = await import('../../features/items/postgres-actions')
    const imported = await importPostgresItems([{ item_name:'Future imported stock',item_type:'material',category_name:'New category',unit_name:'box',location_name:'',
      quantity:7,unit_price:2.5,status:'active',asset_no:null,serial_no:null,brand:null,model:null,responsible_person:null,note:null,
      ledger:materialLedgerSchema.parse({specification:'New specification',commodity_code:'000123',minimum_quantity:0,maximum_quantity:10,fiscal_year:2571,balance_as_of:'2027-10-31',opening_quantity:7,opening_amount:17.5}) }])
    assert.equal(imported.error,null)
    const importedRow=(await client.query("select quantity,specification,commodity_code,minimum_quantity,opening_amount from public.materials where item_name='Future imported stock'")).rows[0]
    assert.equal(importedRow.quantity,7)
    assert.equal(importedRow.specification,'New specification')
    assert.equal(importedRow.commodity_code,'000123')
    assert.equal(importedRow.minimum_quantity,0)
    assert.equal(Number(importedRow.opening_amount),17.5)
    await client.query('commit')
    console.log('PASS: application material issue and reversal update only the new physical table')
    console.log('PASS: migration, history, material ownership, RLS and delete restrictions')
  } finally {
    await client.query('rollback').catch(() => {})
    client.release(); await pool.end()
    await owner.query(`drop database "${name}" with (force)`)
    await owner.end()
  }
})
