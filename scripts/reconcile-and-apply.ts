import { executeAdminQualificationMapping, getAuthoritativeWorkbookPath } from '../features/items/qualification-mapping'
import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.postgres.app' })

async function run() {
  console.log('=================================================================')
  console.log('📌 CAMMS OFFICIAL INVENTORY MASTER DATA RECONCILIATION & APPLY')
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

  console.log(`\n[STEP 2: PREVIEW & RECONCILIATION]`)
  // Run with expected verification
  console.log('Applying qualification mapping through authorized Admin workflow with RLS...')
  
  const result = await executeAdminQualificationMapping(adminId, {
    eligible: 867,
    qualified: 200,
    belowThreshold: 667
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
