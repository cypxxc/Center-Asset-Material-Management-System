import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { calculateStraightLineDepreciation } from './calculation'

export async function getDepreciationReport() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('items').select('id, item_name, asset_no, depreciation_cost, depreciation_useful_life_years, depreciation_start_date, depreciation_residual_value').eq('item_type', 'asset').eq('depreciation_enabled', true).is('deleted_at', null).order('item_name')
  if (error) throw new Error('Unable to load depreciation report')
  const items = (data ?? []).flatMap((item) => {
    const result = calculateStraightLineDepreciation({ enabled: true, cost: item.depreciation_cost, usefulLifeYears: item.depreciation_useful_life_years, startDate: item.depreciation_start_date, residualValue: item.depreciation_residual_value })
    return result ? [{ ...item, ...result }] : []
  })
  return { items, totals: items.reduce((total, item) => ({ cost: total.cost + (item.depreciation_cost ?? 0), accumulated: total.accumulated + item.accumulatedDepreciation, netBook: total.netBook + item.netBookValue }), { cost: 0, accumulated: 0, netBook: 0 }) }
}
