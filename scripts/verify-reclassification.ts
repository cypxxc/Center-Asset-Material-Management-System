import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import { MIGRATION_BATCH_ID } from './reclassify-material-to-asset'

dotenv.config({ path: '.env.postgres.app' })

async function verifyResults() {
  const pool = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL })
  const client = await pool.connect()

  try {
    console.log('====================================================')
    console.log('🔍 FINAL DATABASE VERIFICATION AFTER APPLY')
    console.log('====================================================')

    // 1. Total records check
    const totalActiveRes = await client.query('SELECT count(*) FROM public.items WHERE deleted_at IS NULL')
    const totalDeletedRes = await client.query('SELECT count(*) FROM public.items WHERE deleted_at IS NOT NULL')
    const totalActive = parseInt(totalActiveRes.rows[0].count, 10)
    const totalDeleted = parseInt(totalDeletedRes.rows[0].count, 10)

    console.log(`\n1. Record Counts:`)
    console.log(`   - Total Active Items: ${totalActive} (Expected: 890)`)
    console.log(`   - Total Deleted Items: ${totalDeleted} (Expected: 3)`)

    // 2. item_type breakdown
    const typeRes = await client.query(`
      SELECT item_type, count(*) 
      FROM public.items 
      WHERE deleted_at IS NULL 
      GROUP BY item_type
      ORDER BY count(*) DESC
    `)
    console.log(`\n2. Item Type Breakdown:`)
    typeRes.rows.forEach(r => console.log(`   - ${r.item_type}: ${r.count}`))

    // 3. qualification_status breakdown
    const qualRes = await client.query(`
      SELECT qualification_status, count(*) 
      FROM public.items 
      WHERE deleted_at IS NULL 
      GROUP BY qualification_status
      ORDER BY count(*) DESC
    `)
    console.log(`\n3. Qualification Status Breakdown:`)
    qualRes.rows.forEach(r => console.log(`   - ${r.qualification_status ?? 'Unknown (NULL)'}: ${r.count}`))

    // 4. Cross-tabulation
    const crossRes = await client.query(`
      SELECT item_type, qualification_status, count(*) 
      FROM public.items 
      WHERE deleted_at IS NULL 
      GROUP BY item_type, qualification_status
      ORDER BY item_type, count(*) DESC
    `)
    console.log(`\n4. Cross-tabulation (item_type x qualification_status):`)
    crossRes.rows.forEach(r => console.log(`   - ${r.item_type} + ${r.qualification_status ?? 'Unknown (NULL)'}: ${r.count}`))

    // 5. Audit logs for this batch
    const auditRes = await client.query(`
      SELECT count(*) 
      FROM public.audit_logs 
      WHERE action = 'reclassify_material_to_asset' 
        AND (new_data->>'batch_id') = $1
    `, [MIGRATION_BATCH_ID])
    console.log(`\n5. Audit Logs Recorded for Batch: ${auditRes.rows[0].count} (Expected: 677)`)

    // 6. Sample audit log
    const sampleAudit = await client.query(`
      SELECT id, user_id, action, target_id, old_data, new_data, created_at 
      FROM public.audit_logs 
      WHERE action = 'reclassify_material_to_asset'
      LIMIT 2
    `)
    console.log('\n6. Sample Audit Log Entries:')
    sampleAudit.rows.forEach(r => console.log('   ->', JSON.stringify(r)))

    // 7. Verify expected targets
    const assetCount = typeRes.rows.find(r => r.item_type === 'asset')?.count ?? 0
    const materialCount = typeRes.rows.find(r => r.item_type === 'material')?.count ?? 0
    const qualifiedCount = qualRes.rows.find(r => r.qualification_status === 'qualified')?.count ?? 0
    const belowCount = qualRes.rows.find(r => r.qualification_status === 'below_threshold')?.count ?? 0
    const unknownCount = qualRes.rows.find(r => r.qualification_status === null)?.count ?? 0

    const pass = 
      totalActive === 890 &&
      parseInt(assetCount, 10) === 890 &&
      parseInt(materialCount, 10) === 0 &&
      parseInt(qualifiedCount, 10) === 200 &&
      parseInt(belowCount, 10) === 667 &&
      parseInt(unknownCount, 10) === 23

    console.log('\n====================================================')
    console.log(pass ? '🎉 ALL EXPECTED VERIFICATION TARGETS MET 100%!' : '⚠️ VERIFICATION MISMATCH DETECTED')
    console.log('====================================================')

  } finally {
    client.release()
    await pool.end()
  }
}

verifyResults().catch(console.error)
