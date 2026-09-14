import 'server-only'

import { sql } from 'drizzle-orm'
import { withUserDatabase } from '@/lib/postgres/request'
import { calculateStraightLineDepreciation } from './calculation'

export async function getPostgresDepreciationReport() {
  return withUserDatabase(async (tx) => {
    const rows = await tx.execute<{
      id: string; item_name: string; asset_no: string | null; depreciation_cost: number | null;
      depreciation_useful_life_years: number | null; depreciation_start_date: string | null; depreciation_residual_value: number | null;
    }>(sql`select id, item_name, asset_no, depreciation_cost, depreciation_useful_life_years,
      depreciation_start_date, depreciation_residual_value from public.items
      where item_type = 'asset' and depreciation_enabled = true and deleted_at is null order by item_name`)
    const items = rows.rows.flatMap((item) => {
      const result = calculateStraightLineDepreciation({ enabled: true, cost: item.depreciation_cost, usefulLifeYears: item.depreciation_useful_life_years, startDate: item.depreciation_start_date, residualValue: item.depreciation_residual_value ?? undefined })
      return result ? [{ ...item, ...result }] : []
    })
    return { items, totals: items.reduce((total, item) => ({ cost: total.cost + (item.depreciation_cost ?? 0), accumulated: total.accumulated + item.accumulatedDepreciation, netBook: total.netBook + item.netBookValue }), { cost: 0, accumulated: 0, netBook: 0 }) }
  })
}
