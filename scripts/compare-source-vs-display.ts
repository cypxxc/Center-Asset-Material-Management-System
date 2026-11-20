import { config } from 'dotenv'
import { resolve } from 'node:path'
import type { AcquisitionSummary } from '../features/reports/acquisition-series'
import type { CompletedDisbursementSummary } from '../features/reports/completed-disbursement-series'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env.postgres.app') })

async function compareSourceVsDisplay() {
  console.log('=== COMPARING SOURCE DATA VS DISPLAY AGGREGATIONS ===\n')
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL })
  const client = await pool.connect()

  try {
    const adminRes = await client.query("SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1")
    const adminId = adminRes.rows[0].id
    await client.query(`SELECT set_config('app.user_id', $1, false)`, [adminId])

    const { withIdentity } = await import('../lib/postgres/db')
    const { acquisitionSummarySql, materialAcquisitionSummarySql } = await import('../features/reports/acquisition-sql')
    const { completedDisbursementSummarySql } = await import('../features/reports/completed-disbursement-sql')
    const { buildAcquisitionSeries } = await import('../features/reports/acquisition-series')
    const { buildCompletedDisbursementSeries } = await import('../features/reports/completed-disbursement-series')

    // 1. Direct DB count of assets <= as_of (2026-11-19)
    const dbAssetPast = await client.query(`
      SELECT count(*)::int as count, coalesce(sum(unit_price * quantity), 0)::numeric as val
      FROM public.items 
      WHERE deleted_at IS NULL AND item_type = 'asset' AND acquired_date <= '2026-11-19'
    `)
    const dbAssetFuture = await client.query(`
      SELECT count(*)::int as count 
      FROM public.items 
      WHERE deleted_at IS NULL AND item_type = 'asset' AND acquired_date > '2026-11-19'
    `)
    const dbAssetNull = await client.query(`
      SELECT count(*)::int as count 
      FROM public.items 
      WHERE deleted_at IS NULL AND item_type = 'asset' AND acquired_date IS NULL
    `)

    const assetSummary = await withIdentity(adminId, async tx => (await tx.execute<{ summary: AcquisitionSummary }>(acquisitionSummarySql)).rows[0].summary)
    const assetSeries = buildAcquisitionSeries(assetSummary, 'fiscal', null)

    console.log('--- ASSET VERIFICATION ---')
    console.log('DB Asset Past (<= as_of):', dbAssetPast.rows[0])
    console.log('Chart Asset Totals:', { recordCount: assetSeries.totals.recordCount, knownValue: assetSeries.totals.knownValue })
    console.log('DB Asset Future count:', dbAssetFuture.rows[0].count, '| Chart futureDateCount:', assetSummary.futureDateCount)
    console.log('DB Asset Null count:', dbAssetNull.rows[0].count, '| Chart missingDateCount:', assetSummary.missingDateCount)
    const assetMatch = Number(dbAssetPast.rows[0].count) === assetSeries.totals.recordCount &&
                       Number(dbAssetFuture.rows[0].count) === assetSummary.futureDateCount &&
                       Number(dbAssetNull.rows[0].count) === assetSummary.missingDateCount
    console.log('Asset Verification Status:', assetMatch ? 'PASSED (100% Match)' : 'MISMATCH')

    // 2. Direct DB count of materials <= as_of (2026-11-19)
    const dbMatPast = await client.query(`
      SELECT count(*)::int as count, coalesce(sum(unit_price * quantity), 0)::numeric as val
      FROM public.materials 
      WHERE deleted_at IS NULL AND coalesce(balance_as_of, (created_at at time zone 'Asia/Bangkok')::date) <= '2026-11-19'
    `)
    const dbMatFuture = await client.query(`
      SELECT count(*)::int as count 
      FROM public.materials 
      WHERE deleted_at IS NULL AND coalesce(balance_as_of, (created_at at time zone 'Asia/Bangkok')::date) > '2026-11-19'
    `)

    const matSummary = await withIdentity(adminId, async tx => (await tx.execute<{ summary: AcquisitionSummary }>(materialAcquisitionSummarySql)).rows[0].summary)
    const matSeries = buildAcquisitionSeries(matSummary, 'fiscal', null)

    console.log('\n--- MATERIAL VERIFICATION ---')
    console.log('DB Material Past (<= as_of):', dbMatPast.rows[0])
    console.log('Chart Material Totals:', { recordCount: matSeries.totals.recordCount, knownValue: matSeries.totals.knownValue })
    console.log('DB Material Future count:', dbMatFuture.rows[0].count, '| Chart futureDateCount:', matSummary.futureDateCount)
    const matMatch = Number(dbMatPast.rows[0].count) === matSeries.totals.recordCount &&
                     Number(dbMatFuture.rows[0].count) === matSummary.futureDateCount
    console.log('Material Verification Status:', matMatch ? 'PASSED (100% Match)' : 'MISMATCH')

    // 3. Direct DB count of completed disbursements
    const dbDisCompleted = await client.query(`
      SELECT 
        count(*) filter (where transaction_type = 'asset_borrow')::int as borrowed,
        count(*) filter (where transaction_type in ('material_issue', 'asset_handover'))::int as issued,
        count(*)::int as total
      FROM public.disbursements
      WHERE ((transaction_type in ('material_issue', 'asset_handover') and status = 'confirmed')
         OR (transaction_type = 'asset_borrow' and status in ('active_borrow', 'partially_returned', 'returned')))
        AND coalesce(handed_over_at, confirmed_at) <= current_timestamp
    `)

    const disSummary = await withIdentity(adminId, async tx => (await tx.execute<{ summary: CompletedDisbursementSummary }>(completedDisbursementSummarySql)).rows[0].summary)
    const disSeries = buildCompletedDisbursementSeries(disSummary, 'fiscal', null)

    console.log('\n--- DISBURSEMENT VERIFICATION ---')
    console.log('DB Completed Disbursements:', dbDisCompleted.rows[0])
    console.log('Chart Completed Disbursements Totals:', disSeries.totals)
    const disMatch = Number(dbDisCompleted.rows[0].total) === disSeries.totals.total &&
                     Number(dbDisCompleted.rows[0].borrowed) === disSeries.totals.borrowed &&
                     Number(dbDisCompleted.rows[0].issued) === disSeries.totals.issued
    console.log('Disbursement Verification Status:', disMatch ? 'PASSED (100% Match)' : 'MISMATCH')

  } finally {
    client.release()
    await pool.end()
  }
}

compareSourceVsDisplay().catch(console.error)
