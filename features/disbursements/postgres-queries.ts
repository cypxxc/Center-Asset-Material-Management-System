import 'server-only'
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

export async function getPostgresDisbursements(
  paramsInput: unknown = {}
): Promise<DisbursementListResult> {
  const params = disbursementListParamsSchema.parse(paramsInput)
  const pageSize = params.pageSize
  const page = params.page
  const offset = (page - 1) * pageSize

  const clauses: SQL[] = []

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

      const itemsRes = await tx.execute<DisbursementRow>(
        sql`SELECT d.* FROM public.disbursements d ${whereSql} ORDER BY d.created_at DESC LIMIT ${pageSize} OFFSET ${offset}`
      )

      return {
        items: itemsRes.rows,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
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
        sql`SELECT * FROM public.disbursement_items WHERE disbursement_id = ${id} ORDER BY id ASC`
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
        category_id: string | null
        category_name: string | null
        unit_name: string | null
      }>(
        sql`SELECT 
          i.id,
          i.item_name,
          i.item_type,
          i.asset_no,
          i.serial_no,
          i.quantity,
          c.id as category_id,
          c.name as category_name,
          u.name as unit_name
        FROM public.items i
        LEFT JOIN public.categories c ON c.id = i.category_id
        LEFT JOIN public.units u ON u.id = i.unit_id
        WHERE i.deleted_at IS NULL AND (i.status != 'disposed' OR i.status IS NULL)
        ORDER BY i.item_type ASC, i.item_name ASC`
      )
      return res.rows.map((row) => ({
        id: row.id,
        item_name: row.item_name,
        item_type: row.item_type,
        asset_no: row.asset_no ?? null,
        serial_no: row.serial_no ?? null,
        quantity: Number(row.quantity) || 0,
        category: row.category_id ? { id: row.category_id, name: row.category_name ?? '' } : null,
        unit: row.unit_name ? { name: row.unit_name } : null,
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

