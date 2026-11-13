import { sql } from 'drizzle-orm'

export const adminWorkQueueSql = sql`with clock as (
  select (current_timestamp at time zone 'Asia/Bangkok')::date as as_of
), work as materialized (
  select d.id, d.document_no, d.recipient_name, d.department_name, d.due_date, d.created_at, d.transaction_type, d.purpose,
    case when d.status = 'pending_approval' then 'pending' else 'overdue' end as kind,
    case when d.status = 'pending_approval' then 0 else as_of - d.due_date end as overdue_days
  from public.disbursements d cross join clock
  where d.status = 'pending_approval' or (
    d.transaction_type = 'asset_borrow' and d.status in ('active_borrow', 'partially_returned')
    and d.due_date < as_of
    and exists (
      select 1 from public.disbursement_items di
      where di.disbursement_id = d.id and di.issued_qty > di.returned_qty and di.status <> 'reversed'
    )
  )
), queue as (
  select * from work
  order by case when kind = 'overdue' then 0 else 1 end, overdue_days desc, created_at, id
  limit 8
)
select json_build_object(
  'asOf', (select as_of::text from clock),
  'pendingCount', (select count(*)::int from work where kind = 'pending'),
  'overdueCount', (select count(*)::int from work where kind = 'overdue'),
  'items', coalesce((select json_agg(row_to_json(queue) order by
    case when kind = 'overdue' then 0 else 1 end, overdue_days desc, created_at, id) from queue), '[]'::json)
) as summary`
