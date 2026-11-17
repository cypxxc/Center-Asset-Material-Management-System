import { sql } from 'drizzle-orm'

// One statement gives chart buckets and data-quality counts the same snapshot and date.
function summarySql(itemType: 'asset' | 'material') {
  // Materials are ledger snapshots, not acquisition records. Do not invent acquisition dates.
  const registry = itemType === 'material'
    ? sql`select coalesce(i.balance_as_of, (i.created_at at time zone 'Asia/Bangkok')::date) as acquired_date, i.quantity, i.unit_price
      from public.materials i where i.deleted_at is null and i.item_type = ${itemType}`
    : sql`select i.acquired_date, i.quantity, i.unit_price
      from public.inventory_items i where i.deleted_at is null and i.item_type = ${itemType}`
  return sql`with clock as (
  select (current_timestamp at time zone 'Asia/Bangkok')::date as as_of
), registry as materialized (
  ${registry}
), months as (
  select extract(year from acquired_date)::int as year,
    extract(month from acquired_date)::int as month,
    count(*)::int as "recordCount",
    coalesce(sum(unit_price * quantity) filter (where unit_price is not null), 0) as "knownValue",
    count(*) filter (where unit_price is null)::int as "missingPriceCount"
  from registry cross join clock
  where acquired_date <= as_of
  group by 1, 2
)
select json_build_object(
  'asOf', (select as_of::text from clock),
  'months', coalesce((select json_agg(row_to_json(months) order by year, month) from months), '[]'::json),
  'missingDateCount', (select count(*)::int from registry where acquired_date is null),
  'futureDateCount', (select count(*)::int from registry cross join clock where acquired_date > as_of)
) as summary`
}

export const acquisitionSummarySql = summarySql('asset')
export const materialAcquisitionSummarySql = summarySql('material')
