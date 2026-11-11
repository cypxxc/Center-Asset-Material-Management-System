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

type ItemInput = z.infer<typeof itemFormSchema>
const columns = ['item_name','item_type','qualification_status','category_id','quantity','unit_price','unit_id','asset_no','serial_no','brand','model','location_id','responsible_person','status','note','is_central','image_url','depreciation_enabled','depreciation_cost','depreciation_useful_life_years','depreciation_start_basis','depreciation_start_date','budget_source','gfmis_number','acquired_date'] as const
const uuid = z.string().uuid()

async function editor() {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || !['admin', 'staff'].includes(profile.role)) throw new Error('คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ')
  return profile
}

function databaseMessage(error: unknown) {
  // Drizzle's outer message contains every SQL column name, even for unrelated failures.
  const outer = error as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } } | null
  const databaseError = outer?.cause ?? outer
  if (databaseError?.code === '23505' && databaseError.constraint?.includes('asset_no')) return 'เลขครุภัณฑ์นี้มีอยู่ในระบบแล้ว'
  if (databaseError?.code === '23505' && databaseError.constraint?.includes('serial_no')) return 'Serial Number นี้มีอยู่ในระบบแล้ว'
  return 'ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบข้อมูลอีกครั้ง'
}

function refreshItems() {
  revalidatePath('/items')
  revalidatePath('/', 'layout')
  revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max')
  revalidateTag(CACHE_TAGS.ITEM_REFERENCES, 'max')
}

export async function lockItemReferences(tx: PostgresTransaction, values: Partial<ItemInput>) {
  for (const [column, table] of [['category_id','categories'], ['location_id','locations'], ['unit_id','units']] as const) {
    const id = values[column]
    if (!id) continue
    uuid.parse(id)
    const result = await tx.execute(sql`select id from public.${sql.identifier(table)} where id=${id} and is_active for share`)
    if (!result.rows.length) throw new Error('ข้อมูลหมวดหมู่ สถานที่ หรือหน่วยนับไม่พร้อมใช้งาน')
  }
}

async function insert(tx: PostgresTransaction, data: ItemInput, userId: string) {
  if (data.image_url && !resolveLocalItemImageUrl(data.image_url)) throw new Error('Invalid image URL')
  await lockItemReferences(tx, data)
  const names = [...columns, 'created_by', 'updated_by', 'depreciation_method', 'depreciation_residual_value']
  const values = [...columns.map(key => data[key] ?? null), userId, userId, data.depreciation_enabled ? 'straight_line' : null, 1]
  const result = await tx.execute<{ id: string }>(sql`insert into public.items (${sql.join(names.map(key => sql.identifier(key)), sql`, `)}) values (${sql.join(values.map(value => sql`${value}`), sql`, `)}) returning id`)
  return result.rows[0]
}

export async function insertPostgresItem(data: ItemInput) {
  try {
    const profile = await editor()
    return { data: await withUserDatabase(tx => insert(tx, data, profile.id)), error: null }
  } catch (error) { return { data: null, error: { message: databaseMessage(error) } } }
}

export async function getPostgresItemForUpdate(id: string) {
  await editor()
  uuid.parse(id)
  const result = await withUserDatabase(tx => tx.execute<{ image_url: string | null; [key: string]: unknown }>(sql`select * from public.items where id=${id} and deleted_at is null`))
  return { data: result.rows[0] ?? null, error: null }
}

export async function updatePostgresItem(id: string, data: ItemInput) {
  try {
    uuid.parse(id)
    const profile = await editor()
    if (data.image_url && !resolveLocalItemImageUrl(data.image_url)) throw new Error('Invalid image URL')
    await withUserDatabase(async tx => {
      await lockItemReferences(tx, data)
      const assignments = columns.map(key => sql`${sql.identifier(key)}=${data[key] ?? null}`)
      const result = await tx.execute(sql`update public.items set ${sql.join(assignments, sql`, `)}, updated_by=${profile.id}, updated_at=now(), depreciation_method=${data.depreciation_enabled ? 'straight_line' : null}, depreciation_residual_value=1 where id=${id} and deleted_at is null returning id`)
      if (!result.rows.length) throw new Error('Item not found')
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
    const rows = await withUserDatabase(async tx => {
      const match = sql`id in (${sql.join(uniqueIds.map(id => sql`${id}`), sql`, `)})`
      if (operation === 'update') {
        await lockItemReferences(tx, changes)
        const assignments = [sql`updated_by=${profile.id}`, sql`updated_at=now()`]
        if (changes.location_id !== undefined) assignments.push(sql`location_id=${changes.location_id || null}`)
        if (changes.category_id !== undefined) assignments.push(sql`category_id=${changes.category_id}`)
        if (changes.unit_id !== undefined) assignments.push(sql`unit_id=${changes.unit_id}`)
        if (changes.responsible_person !== undefined) assignments.push(sql`responsible_person=${changes.responsible_person || null}`)
        if (changes.status !== undefined) assignments.push(sql`status=${changes.status}`)
        return (await tx.execute<{ id: string; image_url: string | null }>(sql`update public.items set ${sql.join(assignments, sql`, `)} where ${match} and deleted_at is null returning id, image_url`)).rows
      }
      // Match the current registry behavior: ordinary deletion is permanent; purge targets trash only.
      return (await tx.execute<{ id: string; image_url: string | null }>(sql`delete from public.items where ${match} and ${operation === 'purge' ? sql`deleted_at is not null` : sql`deleted_at is null`} returning id, image_url`)).rows
    })
    if (!rows.length) return errorResponse('ไม่พบรายการที่สามารถดำเนินการได้')
    if (operation !== 'update') await Promise.allSettled(rows.map(row => deleteLocalItemImage(row.image_url)))
    refreshItems()
    return successResponse(`${operation === 'update' ? 'อัปเดต' : 'ลบ'}เรียบร้อย ${rows.length} รายการ`)
  } catch (error) { return errorResponse(databaseMessage(error)) }
}

type ImportRow = {
  item_name: string; item_type: string; qualification_status?: 'qualified' | 'below_threshold' | null; category_name: string; location_name: string; unit_name: string;
  quantity: number; unit_price: number | null; status: string; asset_no: string | null; serial_no: string | null;
  brand: string | null; model: string | null; responsible_person: string | null; note: string | null;
  gfmis_number?: string | null; budget_source?: string | null; acquired_date?: string | null;
}

export async function importPostgresItems(rows: ImportRow[]) {
  try {
    const profile = await editor()
    if (!rows.length || rows.length > 2500) throw new Error('Invalid import size')

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
              ? sql`select id, is_active from public.categories where name=${name} or name=${cleanName} or description=${name} order by case when name=${cleanName} then 1 when name=${name} then 2 else 3 end limit 1 for update`
              : sql`select id, is_active from public.${sql.identifier(table)} where name=${name} order by id limit 1 for update`
          )
          if (result.rows[0] && !result.rows[0].is_active) throw new Error('Reference is inactive')
          references[column] = result.rows[0]?.id ?? (await tx.execute<{id: string}>(sql`insert into public.${sql.identifier(table)} (name, is_active) values (${cleanName}, true) returning id`)).rows[0].id
        }
        const data = itemFormSchema.parse({ ...row, ...references, image_url: '', depreciation_enabled: false,
          asset_no: row.asset_no ?? '', serial_no: row.serial_no ?? '', brand: row.brand ?? '', model: row.model ?? '', responsible_person: row.responsible_person ?? '', note: row.note ?? '',
          gfmis_number: row.gfmis_number ?? '', budget_source: row.budget_source ?? '', acquired_date: row.acquired_date ?? null })
        try {
          await insert(tx, data, profile.id)
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
