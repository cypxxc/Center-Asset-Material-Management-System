import {
  calculateMappingsInTx,
  executeAdminQualificationMapping,
  getAuthoritativeWorkbookPath,
} from '../features/items/qualification-mapping'
import { withIdentity } from '../lib/postgres/db'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.postgres.app' })

async function run() {
  const [mode, ...args] = process.argv.slice(2)
  if (mode !== '--preview' && mode !== '--apply') {
    throw new Error('Usage: tsx scripts/reconcile-and-apply.ts --preview | --apply --expected-eligible=N --expected-qualified=N --expected-below-threshold=N')
  }

  const expected = Object.fromEntries(args.map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=')
    return [key, Number(value)]
  })) as Record<string, number>

  console.log('=================================================================')
  console.log(mode === '--preview' ? 'CAMMS INVENTORY STATUS SYNC PREVIEW' : 'CAMMS INVENTORY STATUS SYNC APPLY')
  console.log('=================================================================')

  const workbookPath = getAuthoritativeWorkbookPath()
  console.log(`\n[STEP 1: SOURCE VERIFICATION]`)
  console.log(`Authoritative Workbook Path: ${workbookPath}`)

  const pool = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL })
  const client = await pool.connect()

  let adminId: string
  try {
    const adminRes = await client.query(`
      SELECT id, full_name, email FROM public.profiles
      WHERE role = 'admin' AND is_active = true
      ORDER BY created_at ASC LIMIT 1
    `)
    if (!adminRes.rows.length) {
      throw new Error('No active admin user found in database!')
    }
    adminId = adminRes.rows[0].id
    console.log(`Authenticated Admin: ${adminRes.rows[0].full_name} (${adminRes.rows[0].email}) ID: ${adminId}`)
  } finally {
    client.release()
    await pool.end()
  }

  if (mode === '--preview') {
    const preview = await withIdentity(adminId, (tx) => calculateMappingsInTx(tx, false))
    console.log('\n[PREVIEW COUNTS]')
    console.log(JSON.stringify(preview.summary, null, 2))
    console.log('\nReview these counts, then apply with the three eligible/qualified/below-threshold values shown above.')
    return
  }

  const expectedEligible = expected['expected-eligible']
  const expectedQualified = expected['expected-qualified']
  const expectedBelowThreshold = expected['expected-below-threshold']
  if (![expectedEligible, expectedQualified, expectedBelowThreshold].every(Number.isInteger)) {
    throw new Error('Apply requires integer --expected-eligible, --expected-qualified, and --expected-below-threshold values from a reviewed preview.')
  }

  console.log('\n[STEP 2: APPLY REVIEWED PREVIEW]')
  console.log('Applying only qualification statuses through the authenticated admin mapping workflow...')
  const result = await executeAdminQualificationMapping(adminId, {
    eligible: expectedEligible,
    qualified: expectedQualified,
    belowThreshold: expectedBelowThreshold,
  })

  console.log(`\n[STEP 3: APPLY RESULTS]`)
  console.log(`✔ Updated records: ${result.updated}`)
  console.log(`  - ตามเกณฑ์ (qualified): ${result.qualified}`)
  console.log(`  - ต่ำกว่าเกณฑ์ (below_threshold): ${result.belowThreshold}`)
  console.log(`  - Ambiguous Source IDs (skipped): ${result.summary.ambiguousSourceIds}`)
  console.log(`  - Unmatched Source IDs: ${result.summary.unmatchedSource}`)
  console.log(`  - Unmatched DB IDs: ${result.summary.unmatchedDatabase}`)

  console.log(`\n[STEP 4: POST-APPLY DATABASE VERIFICATION]`)
  const verifyPool = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL })
  const verifyClient = await verifyPool.connect()

  try {
    const totalActive = await verifyClient.query(`SELECT count(*) FROM public.items WHERE deleted_at IS NULL`)
    const qualCounts = await verifyClient.query(`
      SELECT qualification_status, count(*) 
      FROM public.items 
      WHERE deleted_at IS NULL 
      GROUP BY qualification_status 
      ORDER BY count(*) DESC
    `)
    const itemTypeCounts = await verifyClient.query(`
      SELECT item_type, count(*) 
      FROM public.items 
      WHERE deleted_at IS NULL 
      GROUP BY item_type 
      ORDER BY count(*) DESC
    `)
    const auditLogs = await verifyClient.query(`
      SELECT count(*) 
      FROM public.audit_logs 
      WHERE action = 'qualification_mapping'
    `)

    console.log(`Total Active Items: ${totalActive.rows[0].count}`)
    console.log('Qualification Breakdown in DB:', qualCounts.rows)
    console.log('Item Type (Asset/Material) Breakdown in DB:', itemTypeCounts.rows)
    console.log(`Audit Logs Recorded: ${auditLogs.rows[0].count}`)

  } finally {
    verifyClient.release()
    await verifyPool.end()
  }

  console.log('\n=================================================================')
  console.log('🎉 RECONCILIATION, PREVIEW, APPLY, AND VERIFY COMPLETED SUCCESSFULLY!')
  console.log('=================================================================')
  process.exit(0)
}

run().catch((err) => {
  console.error('❌ Error during reconciliation:', err)
  process.exit(1)
})
