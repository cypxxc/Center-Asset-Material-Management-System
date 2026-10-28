import { Client } from 'pg'
import { parse } from 'dotenv'
import { readFileSync, existsSync } from 'node:fs'

async function main() {
  let connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    if (existsSync('.env.staging')) {
      const parsed = parse(readFileSync('.env.staging'))
      connectionString = parsed.DATABASE_URL
    } else if (existsSync('.env.postgres.app')) {
      const parsed = parse(readFileSync('.env.postgres.app'))
      const url = new URL(parsed.DATABASE_MIGRATION_URL)
      url.pathname = '/camms_staging'
      connectionString = url.toString()
    }
  }

  if (!connectionString) {
    throw new Error('No database connection string found in environment or .env files')
  }

  const client = new Client(connectionString)
  await client.connect()

  const cats = await client.query('SELECT id, name FROM public.categories')
  console.log('=== CATEGORIES ===')
  console.table(cats.rows)

  const units = await client.query('SELECT id, name FROM public.units')
  console.log('=== UNITS ===')
  console.table(units.rows)

  const locs = await client.query('SELECT id, name FROM public.locations')
  console.log('=== LOCATIONS ===')
  console.table(locs.rows)

  const items = await client.query('SELECT id, item_name, asset_no, quantity, status, deleted_at FROM public.items ORDER BY created_at ASC')
  console.log('=== ITEMS ===')
  console.table(items.rows)

  const disb = await client.query('SELECT id, document_no, transaction_type, status, recipient_name FROM public.disbursements ORDER BY created_at ASC')
  console.log('=== DISBURSEMENTS ===')
  console.table(disb.rows)

  const disbItems = await client.query('SELECT id, disbursement_id, item_name_snapshot, requested_qty, issued_qty, returned_qty, status FROM public.disbursement_items')
  console.log('=== DISBURSEMENT ITEMS ===')
  console.table(disbItems.rows)

  await client.end()
}

main().catch(console.error)
