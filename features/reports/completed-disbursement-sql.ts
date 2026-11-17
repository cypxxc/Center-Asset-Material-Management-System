import { sql } from 'drizzle-orm'

// Aggregate headers only: a document with several lines is still one completed transaction.
export const completedDisbursementSummarySql = sql`with clock as (
  select current_timestamp as instant
), eligible as materialized (
  select d.transaction_type, d.handed_over_at,
    coalesce(d.handed_over_at, d.confirmed_at) as completed_at
  from public.disbursements d
  where (d.transaction_type in ('material_issue', 'asset_handover') and d.status = 'confirmed')
     or (d.transaction_type = 'asset_borrow' and d.status in ('active_borrow', 'partially_returned', 'returned'))
), months as (
  select extract(year from completed_at at time zone 'Asia/Bangkok')::int as year,
    extract(month from completed_at at time zone 'Asia/Bangkok')::int as month,
    count(*) filter (where transaction_type = 'asset_borrow')::int as borrowed,
    count(*) filter (where transaction_type in ('material_issue', 'asset_handover'))::int as issued
  from eligible cross join clock
  where completed_at <= instant
  group by 1, 2
)
select json_build_object(
  'asOf', (select (instant at time zone 'Asia/Bangkok')::date::text from clock),
  'months', coalesce((select json_agg(row_to_json(months) order by year, month) from months), '[]'::json),
  'unrecordedHandoverCount', (select count(*)::int from eligible where handed_over_at is null)
) as summary`
