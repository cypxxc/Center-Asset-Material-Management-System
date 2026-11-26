import 'server-only'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'

export async function findOriginLocation(
  tx: PostgresTransaction,
  itemId: string,
  responsiblePerson: string | null
): Promise<{ id: string; name: string } | null> {
  // Step 1: Look at the latest ASSIGN_CUSTODY audit log for this item and this responsible_person
  const assignLogRes = await tx.execute<{
    origin_location_id: string | null
    old_location_id: string | null
    log_created_at: string
    log_id: string
  }>(sql`
    SELECT
      a.new_data->>'origin_location_id' AS origin_location_id,
      a.old_data->>'location_id' AS old_location_id,
      a.created_at::text AS log_created_at,
      a.id::text AS log_id
    FROM public.audit_logs a
    WHERE a.action = 'ASSIGN_CUSTODY'
      AND a.target_table = 'items'
      AND a.target_id = ${itemId}
      AND (${responsiblePerson}::text IS NULL OR a.new_data->>'responsible_person' = ${responsiblePerson})
    ORDER BY a.created_at DESC, a.id DESC
    LIMIT 1
  `)

  const assignLog = assignLogRes.rows[0]
  const explicitLocId = assignLog?.origin_location_id || assignLog?.old_location_id
  if (explicitLocId) {
    const locRes = await tx.execute<{ id: string; name: string }>(sql`
      SELECT id, name FROM public.locations WHERE id = ${explicitLocId}::uuid
    `)
    if (locRes.rows[0]) return locRes.rows[0]
  }

  // Step 2: Check disbursement documents (asset_handover / asset_borrow)
  const disbRes = await tx.execute<{ location_id: string | null; location_name: string }>(sql`
    SELECT l.id AS location_id, coalesce(l.name, di.location_name_snapshot) AS location_name
    FROM public.disbursement_items di
    JOIN public.disbursements d ON d.id = di.disbursement_id
    LEFT JOIN public.locations l ON l.name = di.location_name_snapshot
    WHERE di.item_id = ${itemId}
      AND (${responsiblePerson}::text IS NULL OR d.recipient_name = ${responsiblePerson})
      AND di.location_name_snapshot IS NOT NULL
    ORDER BY d.created_at DESC, di.id DESC
    LIMIT 1
  `)
  if (disbRes.rows[0]?.location_id && disbRes.rows[0]?.location_name) {
    return { id: disbRes.rows[0].location_id, name: disbRes.rows[0].location_name }
  }

  // Step 3: If assignLog exists but didn't have location_id stored in its JSON,
  // find the latest item location audit log BEFORE or AT the time of this assignment
  if (assignLog) {
    const prevLocRes = await tx.execute<{ location_id: string }>(sql`
      SELECT coalesce(al.new_data->>'location_id', al.old_data->>'location_id') AS location_id
      FROM public.audit_logs al
      WHERE al.target_table = 'items'
        AND al.target_id = ${itemId}
        AND al.id::text != ${assignLog.log_id}
        AND al.created_at <= ${assignLog.log_created_at}::timestamptz
        AND (al.new_data->>'location_id' IS NOT NULL OR al.old_data->>'location_id' IS NOT NULL)
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT 1
    `)
    const prevLocId = prevLocRes.rows[0]?.location_id
    if (prevLocId) {
      const loc = await tx.execute<{ id: string; name: string }>(sql`
        SELECT id, name FROM public.locations WHERE id = ${prevLocId}::uuid
      `)
      if (loc.rows[0]) return loc.rows[0]
    }
  }

  // Step 4: Check if there was an earlier RETURN_CUSTODY log before this assignment
  const returnLogRes = await tx.execute<{ location_id: string }>(sql`
    SELECT coalesce(al.new_data->>'origin_location_id', al.new_data->>'location_id') AS location_id
    FROM public.audit_logs al
    WHERE al.action = 'RETURN_CUSTODY'
      AND al.target_table = 'items'
      AND al.target_id = ${itemId}
      ${assignLog ? sql`AND al.created_at < ${assignLog.log_created_at}::timestamptz` : sql.empty()}
    ORDER BY al.created_at DESC, al.id DESC
    LIMIT 1
  `)
  const returnLocId = returnLogRes.rows[0]?.location_id
  if (returnLocId) {
    const loc = await tx.execute<{ id: string; name: string }>(sql`
      SELECT id, name FROM public.locations WHERE id = ${returnLocId}::uuid
    `)
    if (loc.rows[0]) return loc.rows[0]
  }

  // Step 5: Check item creation / import log
  const createLogRes = await tx.execute<{ location_id: string }>(sql`
    SELECT coalesce(al.new_data->>'location_id', al.old_data->>'location_id') AS location_id
    FROM public.audit_logs al
    WHERE al.target_table = 'items'
      AND al.target_id = ${itemId}
      AND (al.new_data->>'location_id' IS NOT NULL OR al.old_data->>'location_id' IS NOT NULL)
    ORDER BY al.created_at ASC, al.id ASC
    LIMIT 1
  `)
  const createLocId = createLogRes.rows[0]?.location_id
  if (createLocId) {
    const loc = await tx.execute<{ id: string; name: string }>(sql`
      SELECT id, name FROM public.locations WHERE id = ${createLocId}::uuid
    `)
    if (loc.rows[0]) return loc.rows[0]
  }

  return null
}
