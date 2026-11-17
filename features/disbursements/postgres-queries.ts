import 'server-only'
import { centralItemUnavailableReason } from './catalog-availability'
import { materialAvailability } from './material-availability'
import { sql, type SQL } from 'drizzle-orm'
import { withUserDatabase } from '@/lib/postgres/request'
import { normalizeForSearch } from '@/lib/unicode'
import type {
  DisbursementRow,
  DisbursementItemRow,
  DisbursementListResult,
  DisbursementSelectableItem,
} from './types'
import { disbursementListParamsSchema } from './schema'
import { COMPLETED_DISBURSEMENT_STATUSES } from './status-groups'

export async function getPostgresDisbursements(
  paramsInput: unknown = {}
): Promise<DisbursementListResult> {
  const params = disbursementListParamsSchema.parse(paramsInput)
  const pageSize = params.pageSize
  const page = params.page
  const offset = (page - 1) * pageSize
  const orderBy = params.prioritizePending
    ? sql`CASE WHEN d.status = 'pending_approval' THEN 0 ELSE 1 END, d.created_at DESC, d.id DESC`
    : sql`d.created_at DESC, d.id DESC`

  const completedStatuses = sql.join(COMPLETED_DISBURSEMENT_STATUSES.map(status => sql`${status}`), sql`, `)
  const clauses: SQL[] = []
  if (params.historyOnly) {
    clauses.push(sql`d.status in (${completedStatuses})`)
  } else if (params.hideCompleted) {
    clauses.push(sql`d.status not in (${completedStatuses})`)
  }

  if (params.request_id) {
    clauses.push(sql`d.id = ${params.request_id}::uuid`)
  }

  if (params.q) {
    const pattern = `%${normalizeForSearch(params.q)}%`
    clauses.push(
      sql`(d.document_no ilike ${pattern} or d.recipient_name ilike ${pattern} or d.department_name ilike ${pattern} or d.purpose ilike ${pattern})`
    )
  }

  if (params.status) {
    clauses.push(sql`d.status = ${params.status}`)
  }

  if (params.type) {
    clauses.push(sql`d.transaction_type = ${params.type}`)
  }

  const whereSql = clauses.length > 0 ? sql`WHERE ${sql.join(clauses, sql` and `)}` : sql``

  return withUserDatabase(async (tx) => {
    try {
      const totalRes = await tx.execute<{ count: number }>(
        sql`SELECT count(*)::int as count FROM public.disbursements d ${whereSql}`
      )
      const total = totalRes.rows[0]?.count ?? 0

      const statsRes = await tx.execute<{
        total: number
        active_borrow: number
        draft: number
        confirmed: number
        pending_approval: number
      }>(
        sql`SELECT
          count(*)::int as total,
          count(*) filter (where d.status = 'active_borrow')::int as active_borrow,
          count(*) filter (where d.status = 'draft')::int as draft,
          count(*) filter (where d.status = 'confirmed')::int as confirmed,
          count(*) filter (where d.status = 'pending_approval')::int as pending_approval
        FROM public.disbursements d WHERE d.status <> 'rejected'`
      )
      const statsRow = statsRes.rows[0]
      const stats = statsRow ? {
        total: statsRow.total ?? 0,
        active_borrow: statsRow.active_borrow ?? 0,
        draft: statsRow.draft ?? 0,
        confirmed: statsRow.confirmed ?? 0,
        pending_approval: statsRow.pending_approval ?? 0,
      } : undefined

      const itemsRes = await tx.execute<DisbursementRow>(
        sql`SELECT d.*, coalesce((SELECT p.full_name FROM public.profiles p WHERE p.id = d.created_by), d.recipient_name) AS requester_name, coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'line_id', di.id,
            'item_id', di.item_id,
            'item_name', coalesce(di.item_name_snapshot, i.item_name, 'ไม่พบรายการ'),
            'asset_no', coalesce(di.asset_no_snapshot, i.asset_no),
            'image_url', i.image_url,
            'requested_qty', di.requested_qty,
            'issued_qty', di.issued_qty,
            'returned_qty', di.returned_qty,
            'status', di.status
          ) ORDER BY di.id)
          FROM public.disbursement_items di LEFT JOIN public.inventory_items i ON i.id = di.item_id
          WHERE di.disbursement_id = d.id ${params.hideCompleted ? sql`AND di.status <> 'returned'` : sql``}
        ), '[]'::jsonb) AS requested_items
        FROM (
          SELECT *, (row_number() OVER (ORDER BY created_at, id))::text AS request_number
          FROM public.disbursements
        ) d ${whereSql} ORDER BY ${orderBy} LIMIT ${pageSize} OFFSET ${offset}`
      )

      return {
        items: itemsRes.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
        stats,
      }
    } catch (error: unknown) {
      const pgCode = (error as { code?: string })?.code || (error as { cause?: { code?: string } })?.cause?.code
      if (pgCode === '42P01') {
        return {
          items: [],
          total: 0,
          page,
          pageSize,
          totalPages: 1,
        }
      }
      throw error
    }
  })
}

export async function getPostgresDisbursementById(id: string) {
  return withUserDatabase(async (tx) => {
    try {
      const docRes = await tx.execute<DisbursementRow>(
        sql`SELECT * FROM public.disbursements WHERE id = ${id}`
      )
      const doc = docRes.rows[0]
      if (!doc) return null

      const linesRes = await tx.execute<DisbursementItemRow>(
        sql`SELECT di.*,
          coalesce(di.item_name_snapshot, CASE WHEN ${doc.status} IN ('draft', 'pending_approval') THEN i.item_name END) AS item_name_snapshot,
          coalesce(di.asset_no_snapshot, CASE WHEN ${doc.status} IN ('draft', 'pending_approval') THEN i.asset_no END) AS asset_no_snapshot
        FROM public.disbursement_items di
        LEFT JOIN public.inventory_items i ON i.id = di.item_id
        WHERE di.disbursement_id = ${id} ORDER BY di.id ASC`
      )

      return {
        ...doc,
        items: linesRes.rows,
      }
    } catch (error: unknown) {
      const pgCode = (error as { code?: string })?.code || (error as { cause?: { code?: string } })?.cause?.code
      if (pgCode === '42P01') {
        return null
      }
      throw error
    }
  })
}

export async function getPostgresDisbursementSelectableItems(): Promise<DisbursementSelectableItem[]> {
  return withUserDatabase(async (tx) => {
    try {
      const res = await tx.execute<{
        id: string
        item_name: string
        item_type: 'material' | 'asset'
        asset_no: string | null
        serial_no: string | null
        quantity: number
        image_url: string | null
        category_id: string | null
        category_name: string | null
        unit_name: string | null
        location_name: string | null
        responsible_person: string | null
        note: string | null
        is_central: boolean
        reserved_quantity: number
      }>(
        sql`SELECT
          i.id,
          i.item_name,
          i.item_type,
          i.asset_no,
          i.serial_no,
          i.quantity,
          i.image_url,
          c.id as category_id,
          c.name as category_name,
          u.name as unit_name,
          l.name as location_name,
          i.responsible_person,
          i.note,
          i.is_central,
          0::int AS reserved_quantity
        FROM public.inventory_items i
        LEFT JOIN public.categories c ON c.id = i.category_id
        LEFT JOIN public.units u ON u.id = i.unit_id
        LEFT JOIN public.locations l ON l.id = i.location_id
        WHERE i.deleted_at IS NULL AND i.quantity > 0
          AND (i.item_type='material' OR i.is_central = true OR i.note LIKE '%ส่วนกลาง%')
          AND (i.status IN ('active', 'spare') OR i.status IS NULL)
          AND (i.item_type='material' OR NOT EXISTS (
            SELECT 1 FROM public.disbursement_items di
            JOIN public.disbursements d ON d.id = di.disbursement_id
            WHERE di.item_id = i.id
              AND d.status IN ('pending_approval', 'active_borrow', 'partially_returned')
              AND di.status NOT IN ('returned', 'reversed')
          ))
        ORDER BY i.item_type ASC, i.item_name ASC`
      )
      return res.rows.map((row) => ({
        id: row.id,
        item_name: row.item_name,
        item_type: row.item_type,
        asset_no: row.asset_no ?? null,
        serial_no: row.serial_no ?? null,
        quantity: row.item_type === 'material' ? materialAvailability(Number(row.quantity)).available_quantity : Number(row.quantity) || 0,
        ...materialAvailability(Number(row.quantity)),
        image_url: row.image_url ?? null,
        category: row.category_id ? { id: row.category_id, name: row.category_name ?? '' } : null,
        unit: row.unit_name ? { name: row.unit_name } : null,
        location_name: row.location_name ?? null,
        responsible_person: row.responsible_person ?? null,
        note: row.note ?? null,
        is_central: row.item_type === 'material' || Boolean(row.is_central),
      }))
    } catch (error: unknown) {
      const pgCode = (error as { code?: string })?.code || (error as { cause?: { code?: string } })?.cause?.code
      if (pgCode === '42P01') {
        return []
      }
      throw error
    }
  })
}

export interface CentralAvailableItem {
  specification?: string | null
  stock_quantity?: number
  reserved_quantity?: number
  available_quantity?: number
  unavailable_reason?: string | null
  id: string
  item_name: string
  item_type: 'material' | 'asset'
  asset_no: string | null
  serial_no: string | null
  brand: string | null
  model: string | null
  quantity: number
  image_url: string | null
  category: { id: string; name: string } | null
  unit_name: string | null
  location_name: string | null
}

export async function getPostgresCentralAvailableItems(): Promise<CentralAvailableItem[]> {
  return withUserDatabase(async (tx) => {
    try {
      const res = await tx.execute<{
        status: string | null
        reserved: boolean
        reserved_quantity: number
        id: string
        item_name: string
        item_type: 'material' | 'asset'
        asset_no: string | null
        serial_no: string | null
        brand: string | null
        model: string | null
        quantity: number
        image_url: string | null
        category_id: string | null
        category_name: string | null
        unit_name: string | null
        location_name: string | null
        specification: string | null
      }>(
        sql`SELECT
          i.id,
          i.item_name,
          i.item_type,
          i.asset_no,
          i.serial_no,
          i.brand,
          i.model,
          i.quantity,
          i.image_url,
          c.id as category_id,
          c.name as category_name,
          u.name as unit_name,
          l.name as location_name,
          m.specification,
          i.status,
          EXISTS (
            SELECT 1 FROM public.disbursement_items di
            JOIN public.disbursements d ON d.id = di.disbursement_id
            WHERE di.item_id = i.id
              AND d.status IN ('pending_approval', 'active_borrow', 'partially_returned')
              AND di.status NOT IN ('returned', 'reversed')
          ) AS reserved,
          0::int AS reserved_quantity
        FROM public.inventory_items i
        LEFT JOIN public.materials m ON m.id = i.id AND i.item_type = 'material'
        LEFT JOIN public.categories c ON c.id = i.category_id
        LEFT JOIN public.units u ON u.id = i.unit_id
        LEFT JOIN public.locations l ON l.id = i.location_id
        WHERE i.deleted_at IS NULL AND i.quantity > 0
          AND (i.item_type='material' OR i.is_central = true OR i.note ILIKE '%ส่วนกลาง%')
          AND (i.status IN ('active', 'spare') OR i.status IS NULL)
          AND (i.item_type='material' OR NOT EXISTS (
            SELECT 1 FROM public.disbursement_items di
            JOIN public.disbursements d ON d.id = di.disbursement_id
            WHERE di.item_id = i.id
              AND d.status IN ('pending_approval', 'active_borrow', 'partially_returned')
              AND di.status NOT IN ('returned', 'reversed')
          ))
        ORDER BY i.item_name ASC`
      )

      return res.rows.map((row) => ({
        unavailable_reason: centralItemUnavailableReason({ quantity: row.item_type === 'material' ? materialAvailability(Number(row.quantity)).available_quantity : Number(row.quantity), status: row.status, reserved: row.item_type === 'material' ? false : row.reserved }),
        id: row.id,
        item_name: row.item_name,
        item_type: row.item_type,
        asset_no: row.asset_no ?? null,
        serial_no: row.serial_no ?? null,
        brand: row.brand ?? null,
        model: row.model ?? null,
        quantity: row.item_type === 'material' ? materialAvailability(Number(row.quantity)).available_quantity : Number(row.quantity) || 0,
        ...materialAvailability(Number(row.quantity)),
        image_url: row.image_url ?? null,
        category: row.category_id ? { id: row.category_id, name: row.category_name ?? '' } : null,
        unit_name: row.unit_name ?? null,
        location_name: row.location_name ?? null,
        specification: row.specification ?? null,
      }))
    } catch (error: unknown) {
      const pgCode = (error as { code?: string })?.code || (error as { cause?: { code?: string } })?.cause?.code
      if (pgCode === '42P01') {
        return []
      }
      throw error
    }
  })
}

