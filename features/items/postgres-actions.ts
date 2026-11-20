import 'server-only'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { getCurrentProfile } from '@/features/auth/queries'
import { withUserDatabase } from '@/lib/postgres/request'
import type { PostgresTransaction } from '@/lib/postgres/db'
import { itemFormSchema } from './schema'
import { bulkUpdatesSchema } from './bulk-edit'
import { deleteLocalItemImage, resolveLocalItemImageUrl } from '@/lib/postgres/storage'
import { errorResponse, successResponse, type ActionResponse } from '@/lib/actions-helper'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logging'
import { archivePostgresItems, ItemArchiveBlockedError } from './archive-items'
import { lockDisbursementItems } from '@/features/disbursements/reservations'
import { assertNoDuplicateMaterials, resolvedMaterialCategory, type MaterialImportIdentity } from './import-validation'
import { inventoryTable } from './inventory-table'
import { MATERIAL_LEDGER_FIELDS, materialLedgerSchema, type MaterialLedgerData } from './material-fields'
import { ASSET_REGISTER_FIELDS, type AssetRegisterData } from './asset-register'
import { metadataUpdateColumns } from '@/features/materials/stock-rules'

type ItemInput = z.infer<typeof itemFormSchema>
const columns = ['item_name','item_type','qualification_status','category_id','quantity','unit_price','unit_id','asset_no','serial_no','brand','model','location_id','responsible_person','status','note','is_central','image_url','depreciation_enabled','depreciation_cost','depreciation_useful_life_years','depreciation_start_basis','depreciation_start_date','budget_source','gfmis_number','acquired_date'] as const
const uuid = z.string().uuid()

async function editor() {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || profile.role !== 'admin') throw new Error('คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ')
  return profile
}

const borrowedCustodyMessage = 'ไม่สามารถเปลี่ยนผู้ถือครองครุภัณฑ์ที่ยังอยู่ระหว่างการยืมหรือมีรายการจ่ายที่ยังไม่ปิดได้'

function blocksCustodianChange(responsiblePerson: string | null) {
  return sql`
    (d.status = 'pending_approval' OR (
      d.transaction_type = 'asset_borrow' AND d.status IN ('active_borrow', 'partially_returned')
    ))
    AND di.status IN ('issued', 'partially_returned') AND di.issued_qty > di.returned_qty
    AND EXISTS (
      SELECT 1 FROM public.items i WHERE i.id = di.item_id AND i.deleted_at IS NULL
        AND i.responsible_person IS DISTINCT FROM ${responsiblePerson}::text
    )
  `
}

function databaseMessage(error: unknown) {
  if (error instanceof MaterialMetadataConflict) return error.message
  if (error instanceof Error && error.message === borrowedCustodyMessage) return error.message
  if (error instanceof Error && error.message.includes('ไม่สามารถเปลี่ยนสถานะ')) return error.message
  // Drizzle's outer message contains every SQL column name, even for unrelated failures.
  const outer = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } } | null
  const databaseError = outer?.cause ?? outer
  if (databaseError?.code === '23505' && databaseError.constraint?.includes('asset_no')) return 'เลขครุภัณฑ์นี้มีอยู่ในระบบแล้ว'
  if (databaseError?.code === '23505' && databaseError.constraint?.includes('serial_no')) return 'Serial Number นี้มีอยู่ในระบบแล้ว'
  return 'ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบข้อมูลอีกครั้ง'
}

class MaterialMetadataConflict extends Error {
  constructor() { super('ข้อมูลวัสดุเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง') }
}

function refreshItems() {
  revalidatePath('/items')
  revalidatePath('/', 'layout')
  revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max')
  revalidateTag(CACHE_TAGS.ITEM_REFERENCES, 'max')
  revalidateTag(CACHE_TAGS.ITEMS, 'max')
}

export async function lockItemReferences(tx: PostgresTransaction, values: Partial<ItemInput>) {
  for (const [column, table] of [['category_id','categories'], ['location_id','locations'], ['unit_id','units']] as const) {
    const id = values[column]
    if (!id) continue
    uuid.parse(id)
    const result = await tx.execute(sql`select id from public.${sql.identifier(table)} where id=${id} and is_active ${table === 'categories' ? sql`and item_type=${values.item_type}` : sql``} for share`)
    if (!result.rows.length) throw new Error('ข้อมูลหมวดหมู่ สถานที่ หรือหน่วยนับไม่พร้อมใช้งาน')
  }
}

async function insert(tx: PostgresTransaction, data: ItemInput, userId: string, ledger?: MaterialLedgerData) {
  if (data.image_url && !resolveLocalItemImageUrl(data.image_url)) throw new Error('Invalid image URL')
  await lockItemReferences(tx, data)
  const names = [...columns, 'created_by', 'updated_by', 'depreciation_method', 'depreciation_residual_value']
  const values = [...columns.map(key => data[key] ?? null), userId, userId, data.depreciation_enabled ? 'straight_line' : null, 1]
  if (data.item_type === 'asset') {
    names.push(...ASSET_REGISTER_FIELDS)
    values.push(...ASSET_REGISTER_FIELDS.map(key => data[key] ?? null))
  }
  const materialFields = data.item_type === 'material' ? materialLedgerSchema.parse(ledger ?? {}) : null
  if (materialFields) {
    names.push(...MATERIAL_LEDGER_FIELDS)
    values.push(...MATERIAL_LEDGER_FIELDS.map(key => materialFields[key]))
  }
  const result = await tx.execute<{ id: string }>(sql`insert into ${inventoryTable(data.item_type)} (${sql.join(names.map(key => sql.identifier(key)), sql`, `)}) values (${sql.join(values.map(value => sql`${value}`), sql`, `)}) returning id`)
  return result.rows[0]
}

export async function insertPostgresItem(data: ItemInput, ledger?: MaterialLedgerData) {
  try {
    const profile = await editor()
    return { data: await withUserDatabase(tx => insert(tx, data, profile.id, ledger)), error: null }
  } catch (error) { return { data: null, error: { message: databaseMessage(error) } } }
}

export async function getPostgresItemForUpdate(id: string) {
  await editor()
  uuid.parse(id)
  const result = await withUserDatabase(tx => tx.execute<{ image_url: string | null; [key: string]: unknown }>(sql`select * from public.inventory_items where id=${id} and deleted_at is null`))
  return { data: result.rows[0] ?? null, error: null }
}

export async function updatePostgresItem(id: string, data: ItemInput, ledger?: MaterialLedgerData, expectedMetadataVersion?: number) {
  try {
    uuid.parse(id)
    const profile = await editor()
    if (data.image_url && !resolveLocalItemImageUrl(data.image_url)) throw new Error('Invalid image URL')
    await withUserDatabase(async tx => {
      if (data.item_type === 'asset') await lockDisbursementItems(tx, [id])
      await lockItemReferences(tx, data)
      const registry = await tx.execute<{ item_type: string }>(sql`select item_type from public.inventory_registry where id=${id}::uuid`)
      const itemType = registry.rows[0]?.item_type
      if (!itemType || itemType !== data.item_type) throw new Error('ประเภทสิ่งของไม่ตรงกับทะเบียน')
      if (itemType === 'material' && (!Number.isSafeInteger(expectedMetadataVersion) || Number(expectedMetadataVersion) < 1)) throw new MaterialMetadataConflict()
      const table = inventoryTable(itemType)
      const assignments = metadataUpdateColumns(columns, itemType).map(key => sql`${sql.identifier(key)}=${data[key] ?? null}`)
      if (data.item_type === 'asset') {
        const blocked = await tx.execute(sql`
          SELECT 1 FROM public.disbursement_items di
          JOIN public.disbursements d ON d.id = di.disbursement_id
          WHERE di.item_id = ${id} AND ${blocksCustodianChange(data.responsible_person ?? null)}
          LIMIT 1
        `)
        if (blocked.rows.length) throw new Error(borrowedCustodyMessage)
        assignments.push(...ASSET_REGISTER_FIELDS.map(key => sql`${sql.identifier(key)}=${data[key] ?? null}`))
      }
      if (ledger && data.item_type === 'material') {
        const validated = materialLedgerSchema.parse(ledger)
        assignments.push(...MATERIAL_LEDGER_FIELDS.map(key => sql`${sql.identifier(key)}=${validated[key]}`))
      }
      const result = await tx.execute(sql`update ${table} set ${sql.join(assignments, sql`, `)}, updated_by=${profile.id}, updated_at=now(), depreciation_method=${data.depreciation_enabled ? 'straight_line' : null}, depreciation_residual_value=1 where id=${id} and deleted_at is null ${itemType === 'material' ? sql`and metadata_version=${expectedMetadataVersion}` : sql``} returning id`)
      if (!result.rows.length) {
        if (itemType === 'material') throw new MaterialMetadataConflict()
        throw new Error('Item not found')
      }
    })
    return { error: null }
  } catch (error) { return { error: { message: databaseMessage(error) } } }
}

export async function mutatePostgresItems(ids: string[], operation: 'update' | 'delete' | 'purge', updates?: Record<string, unknown>): Promise<ActionResponse> {
  try {
    const profile = await editor()
    if ((operation === 'delete' || operation === 'purge') && profile.role !== 'admin') {
      return errorResponse('เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ทำรายการนี้')
    }
    const rate = await checkRateLimit(`items-${operation}`, 30, 60000)
    if (!rate.success) return errorResponse(rate.error!)
    const validIds = z.array(uuid).min(1).max(1000).parse(ids)
    const uniqueIds = [...new Set(validIds)]
    const changes = operation === 'update' ? bulkUpdatesSchema.parse(updates) : {}
    const makesUnavailable = operation === 'update' && changes.status !== undefined && !['active', 'spare'].includes(changes.status)
    const changesCustodian = changes.responsible_person !== undefined
    const rows = await withUserDatabase(async tx => {
      if (makesUnavailable || changesCustodian) await lockDisbursementItems(tx, uniqueIds)
      const match = sql`id in (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})`
      const affected: Array<{ id: string; image_url: string | null }> = []
      for (const type of ['asset', 'material'] as const) {
      const table = inventoryTable(type)
      if (operation === 'update') {
        const selected = await tx.execute(sql`select id from ${table} where ${match} and deleted_at is null limit 1`)
        if (!selected.rows.length) continue
        await lockItemReferences(tx, { ...changes, item_type: type })
        const checksCustody = type === 'asset' && changesCustodian
        if (makesUnavailable || checksCustody) {
          const blocked = await tx.execute(sql`
            select di.item_id from public.disbursement_items di
            join public.disbursements d on d.id = di.disbursement_id
            where di.item_id in (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)}) and (
              (${makesUnavailable} and d.status in ('draft', 'pending_approval') and di.status <> 'reversed')
              or (${makesUnavailable} and d.transaction_type = 'asset_borrow' and d.status in ('active_borrow', 'partially_returned')
                and di.issued_qty > di.returned_qty and di.status <> 'reversed'
              )
              or (${checksCustody} and ${blocksCustodianChange(changes.responsible_person || null)})
            ) limit 1
          `)
          if (blocked.rows.length) {
            if (!makesUnavailable) throw new Error(borrowedCustodyMessage)
            throw new Error('รายการที่เลือกมีเอกสารร่าง คำขอรออนุมัติ หรือมีรายการยืมที่ยังไม่คืน ไม่สามารถเปลี่ยนสถานะเป็นไม่พร้อมใช้งานได้')
          }
        }
        const assignments = [sql`updated_by=${profile.id}`, sql`updated_at=now()`]
        if (changes.location_id !== undefined) assignments.push(sql`location_id=${changes.location_id || null}`)
        if (changes.category_id !== undefined) assignments.push(sql`category_id=${changes.category_id}`)
        if (changes.unit_id !== undefined) assignments.push(sql`unit_id=${changes.unit_id}`)
        if (type === 'asset' && changes.responsible_person !== undefined) assignments.push(sql`responsible_person=${changes.responsible_person || null}`)
        if (changes.status !== undefined) assignments.push(sql`status=${changes.status}`)
        affected.push(...(await tx.execute<{ id: string; image_url: string | null }>(sql`update ${table} set ${sql.join(assignments, sql`, `)} where ${match} and deleted_at is null returning id, image_url`)).rows)
        continue
      }
      if (operation === 'delete') { affected.push(...await archivePostgresItems(tx, uniqueIds, profile.id, type)); continue }
      // Permanent purge remains separate and cannot remove referenced historical rows.
      affected.push(...(await tx.execute<{ id: string; image_url: string | null }>(sql`delete from ${table} where ${match} and deleted_at is not null returning id, image_url`)).rows)
      }
      return affected
    })
    if (!rows.length) return errorResponse('ไม่พบรายการที่สามารถดำเนินการได้')
    if (operation === 'purge') await Promise.allSettled(rows.map(row => deleteLocalItemImage(row.image_url)))
    refreshItems()
    return successResponse(`${operation === 'update' ? 'อัปเดต' : 'ลบ'}เรียบร้อย ${rows.length} รายการ`)
  } catch (error) {
    if (error instanceof ItemArchiveBlockedError) return errorResponse(error.message)
    if (operation === 'update') return errorResponse(databaseMessage(error))
    const outer = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } } | null
    const databaseError = outer?.cause ?? outer
    // Drizzle messages include SQL and bound values: log only safe diagnostic fields.
    logger.error({ operation, feature: 'items', status: 'failed', details: {
      code: databaseError?.code, constraint: databaseError?.constraint, requestedCount: ids.length,
    } })
    if (databaseError?.code === '23503') {
      return errorResponse('ไม่สามารถลบรายการได้ เนื่องจากมีเอกสารหรือประวัติการเบิกจ่าย/ถือครองอ้างอิงอยู่ กรุณาตรวจสอบรายการที่เลือก')
    }
    return errorResponse('ไม่สามารถลบรายการได้ กรุณาลองอีกครั้ง หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบ')
  }
}

type ImportRow = Partial<AssetRegisterData> & {
  ledger?: MaterialLedgerData;
  item_name: string; item_type: string; qualification_status?: 'qualified' | 'below_threshold' | null; category_name: string; location_name: string; unit_name: string;
  quantity: number; unit_price: number | null; status: string; asset_no: string | null; serial_no: string | null;
  brand: string | null; model: string | null; responsible_person: string | null; note: string | null;
  gfmis_number?: string | null; budget_source?: string | null; acquired_date?: string | null;
}

export async function importPostgresItems(rows: ImportRow[]) {
  try {
    const profile = await editor()
    if (!rows.length || rows.length > 2500) throw new Error('Invalid import size')
    assertNoDuplicateMaterials(rows, [])

    // 1. ตรวจสอบเลขครุภัณฑ์ซ้ำภายในไฟล์ที่นำเข้าเอง (Within Batch)
    const seenAssets = new Map<string, { rowIdx: number; itemName: string }>()
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.asset_no) continue
      const cleanAsset = r.asset_no.trim()
      if (seenAssets.has(cleanAsset)) {
        const prev = seenAssets.get(cleanAsset)!
        return {
          data: null,
          error: {
            message: `พบเลขครุภัณฑ์ซ้ำซ้อนภายในไฟล์ที่นำเข้า:\n• แถวที่ ${i + 1}: "${cleanAsset}" (${r.item_name})\n  ตรงกับแถวที่ ${prev.rowIdx}: (${prev.itemName})\n\nกรุณาแก้ไขเลขครุภัณฑ์ไม่ให้ซ้ำกันก่อนนำเข้า`,
          },
        }
      }
      seenAssets.set(cleanAsset, { rowIdx: i + 1, itemName: r.item_name })
    }

    // 2. ตรวจสอบ Serial Number ซ้ำภายในไฟล์ที่นำเข้าเอง
    const seenSerials = new Map<string, { rowIdx: number; itemName: string }>()
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.serial_no) continue
      const cleanSerial = r.serial_no.trim()
      if (seenSerials.has(cleanSerial)) {
        const prev = seenSerials.get(cleanSerial)!
        return {
          data: null,
          error: {
            message: `พบ Serial Number ซ้ำซ้อนภายในไฟล์ที่นำเข้า:\n• แถวที่ ${i + 1}: "${cleanSerial}" (${r.item_name})\n  ตรงกับแถวที่ ${prev.rowIdx}: (${prev.itemName})\n\nกรุณาแก้ไข Serial Number ก่อนนำเข้า`,
          },
        }
      }
      seenSerials.set(cleanSerial, { rowIdx: i + 1, itemName: r.item_name })
    }

    const count = await withUserDatabase(async tx => {
      // Serialize metadata name creation for concurrent imports (locations permit duplicate names).
      await tx.execute(sql`select pg_advisory_xact_lock(736821)`)
      if (rows.some(row => row.item_type === 'material')) {
        const categories = await tx.execute<{ name: string; description: string | null; [key: string]: unknown }>(sql`select name, description from public.categories where item_type = 'material'`)
        const existingMaterials = await tx.execute<MaterialImportIdentity & Record<string, unknown>>(sql`
          select i.item_type, i.item_name, c.name as category_name, u.name as unit_name,
            l.name as location_name, i.note
          from public.materials i
          left join public.categories c on c.id = i.category_id
          left join public.units u on u.id = i.unit_id
          left join public.locations l on l.id = i.location_id
          where i.item_type = 'material' and i.deleted_at is null
        `)
        assertNoDuplicateMaterials(rows.map(row => ({ ...row, category_name: resolvedMaterialCategory(row.category_name, categories.rows) })), existingMaterials.rows)
      }

      // 3. ตรวจสอบเลขครุภัณฑ์ซ้ำกับที่มีอยู่ในฐานข้อมูลระบบแล้ว (Pre-check collisions)
      const uniqueAssetNos = Array.from(seenAssets.keys())
      if (uniqueAssetNos.length > 0) {
        const existingItems = await tx.execute<{ asset_no: string; item_name: string }>(
          sql`select asset_no, item_name from public.items where asset_no in (${sql.join(uniqueAssetNos.map(a => sql`${a}`), sql`, `)}) and deleted_at is null`
        )
        if (existingItems.rows.length > 0) {
          const totalDups = existingItems.rows.length
          const sampleDups = existingItems.rows.slice(0, 10).map(dup => {
            const importRow = rows.find(r => r.asset_no?.trim() === dup.asset_no)
            const rowIdx = rows.findIndex(r => r.asset_no?.trim() === dup.asset_no) + 1
            const importName = importRow ? ` (${importRow.item_name})` : ''
            return `• แถวที่ ${rowIdx}: เลขครุภัณฑ์ "${dup.asset_no}"${importName}\n  ↳ ซ้ำกับรายการในระบบ: "${dup.item_name}"`
          })
          const more = totalDups > 10 ? `\n...และรายการอื่นอีก ${totalDups - 10} รายการ` : ''
          throw new Error(
            `พบเลขครุภัณฑ์ซ้ำกับที่มีอยู่ในระบบแล้ว ${totalDups} รายการ:\n${sampleDups.join('\n')}${more}\n\nกรุณาตรวจสอบว่าข้อมูลนี้เคยถูกนำเข้าแล้ว หรือปรับปรุงเลขครุภัณฑ์ก่อนนำเข้าอีกครั้ง`
          )
        }
      }

      // 4. ตรวจสอบ Serial Number ซ้ำกับที่มีอยู่ในฐานข้อมูลระบบ
      const uniqueSerialNos = Array.from(seenSerials.keys())
      if (uniqueSerialNos.length > 0) {
        const existingSerials = await tx.execute<{ serial_no: string; item_name: string }>(
          sql`select serial_no, item_name from public.items where serial_no in (${sql.join(uniqueSerialNos.map(s => sql`${s}`), sql`, `)}) and deleted_at is null`
        )
        if (existingSerials.rows.length > 0) {
          const totalDups = existingSerials.rows.length
          const sampleDups = existingSerials.rows.slice(0, 10).map(dup => {
            const importRow = rows.find(r => r.serial_no?.trim() === dup.serial_no)
            const rowIdx = rows.findIndex(r => r.serial_no?.trim() === dup.serial_no) + 1
            const importName = importRow ? ` (${importRow.item_name})` : ''
            return `• แถวที่ ${rowIdx}: Serial Number "${dup.serial_no}"${importName}\n  ↳ ซ้ำกับรายการในระบบ: "${dup.item_name}"`
          })
          const more = totalDups > 10 ? `\n...และรายการอื่นอีก ${totalDups - 10} รายการ` : ''
          throw new Error(
            `พบ Serial Number ซ้ำกับที่มีอยู่ในระบบแล้ว ${totalDups} รายการ:\n${sampleDups.join('\n')}${more}\n\nกรุณาตรวจสอบ Serial Number ก่อนนำเข้าอีกครั้ง`
          )
        }
      }

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const references: Record<string, string | undefined> = {}
        for (const [nameKey, column, table] of [['category_name','category_id','categories'],['location_name','location_id','locations'],['unit_name','unit_id','units']] as const) {
          const name = row[nameKey]
          if (!name) continue
          if (name.length > 120) throw new Error('Reference name too long')
          const cleanName = table === 'categories' ? name.replace(/^\d{4}\s*-\s*/, '').trim() : name
          const result = await tx.execute<{ id: string; is_active: boolean }>(
            table === 'categories'
              ? sql`select id, is_active from public.categories where item_type=${row.item_type} and (name=${name} or name=${cleanName} or description=${name}) order by case when name=${cleanName} then 1 when name=${name} then 2 else 3 end limit 1 for update`
              : sql`select id, is_active from public.${sql.identifier(table)} where name=${name} order by id limit 1 for update`
          )
          if (result.rows[0] && !result.rows[0].is_active) throw new Error('Reference is inactive')
          references[column] = result.rows[0]?.id ?? (await tx.execute<{id: string}>(table === 'categories'
            ? sql`insert into public.categories (name, item_type, is_active) values (${cleanName}, ${row.item_type}, true) on conflict (name, item_type) do update set name=excluded.name returning id`
            : sql`insert into public.${sql.identifier(table)} (name, is_active) values (${cleanName}, true) returning id`)).rows[0].id
        }
        const data = itemFormSchema.parse({ ...row, ...references, image_url: '', depreciation_enabled: false,
          asset_no: row.asset_no ?? '', serial_no: row.serial_no ?? '', brand: row.brand ?? '', model: row.model ?? '', responsible_person: row.responsible_person ?? '', note: row.note ?? '',
          gfmis_number: row.gfmis_number ?? '', budget_source: row.budget_source ?? '', acquired_date: row.acquired_date ?? null })
        try {
          await insert(tx, data, profile.id, row.ledger)
        } catch (err: unknown) {
          const outer = err as { code?: string; constraint?: string; detail?: string; cause?: { code?: string; constraint?: string; detail?: string } } | null
          const dbErr = outer?.cause ?? outer
          if (dbErr?.code === '23505' && dbErr.constraint?.includes('asset_no')) {
            throw new Error(`แถวที่ ${i + 1}: เลขครุภัณฑ์ "${row.asset_no || ''}" (${row.item_name}) ซ้ำกับที่มีอยู่ในระบบแล้ว`)
          }
          if (dbErr?.code === '23505' && dbErr.constraint?.includes('serial_no')) {
            throw new Error(`แถวที่ ${i + 1}: Serial Number "${row.serial_no || ''}" (${row.item_name}) ซ้ำกับที่มีอยู่ในระบบแล้ว`)
          }
          throw err
        }
      }
      return rows.length
    })
    return { data: { ok: true, count }, error: null }
  } catch (error) {
    if (error instanceof Error && (error.message.includes('ซ้ำ') || error.message.includes('แถวที่'))) {
      return { data: null, error: { message: error.message } }
    }
    return { data: null, error: { message: databaseMessage(error) } }
  }
}
