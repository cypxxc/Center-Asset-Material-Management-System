import 'server-only'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getCurrentProfile } from '@/features/auth/queries'
import { withUserDatabase } from '@/lib/postgres/request'
import { CACHE_TAGS } from '@/lib/cache-tags'
import { checkRateLimit } from '@/lib/rate-limit'
import { categorySchema, locationSchema, unitSchema } from './schema'
import { pgUpdateUserProfile } from '@/features/admin/postgres-admin'
import { writeAuditLog } from '@/lib/audit'

const definitions = {
  categories: { schema: categorySchema, reference: 'category_id', columns: ['name', 'description', 'is_active'] },
  locations: { schema: locationSchema, reference: 'location_id', columns: ['name', 'building', 'floor', 'room', 'department', 'description', 'is_active'] },
  units: { schema: unitSchema, reference: 'unit_id', columns: ['name', 'is_active'] },
} as const
type MetadataTable = keyof typeof definitions

function finish(tab: string, error?: string): never {
  if (!error) {
    for (const path of ['/settings','/items/new','/items']) revalidatePath(path)
    revalidatePath('/', 'layout')
    revalidateTag(CACHE_TAGS.ITEM_REFERENCES, 'max')
    revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max')
  }
  redirect(`/settings?tab=${tab}&${error ? 'error' : 'message'}=${encodeURIComponent(error || 'บันทึกการเปลี่ยนแปลงสำเร็จ')}`)
}

function friendlyError(error: unknown) {
  const record = error as { code?: string; cause?: {code?: string} }
  const code = record.code || record.cause?.code
  if (code === '23503') return 'ไม่สามารถลบข้อมูลนี้ได้เนื่องจากกำลังถูกใช้งานโดยพัสดุในระบบ'
  if (code === '23505') return 'มีข้อมูลชื่อนี้อยู่ในระบบแล้ว'
  return 'ไม่สามารถบันทึกการตั้งค่าได้ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง'
}

export async function mutatePostgresMetadata(table: MetadataTable, operation: 'create' | 'update' | 'delete', formData?: FormData, id?: string): Promise<never> {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || !['admin','staff'].includes(profile.role)) finish(table, 'คุณไม่มีสิทธิ์จัดการตั้งค่า')
  const rate = await checkRateLimit(`${operation}-${table}`, 30, 60000)
  if (!rate.success) finish(table, rate.error!)
  if (!Object.hasOwn(definitions, table)) finish('categories', 'ข้อมูลไม่ถูกต้อง')
  if (operation !== 'create' && !z.string().uuid().safeParse(id).success) finish(table, 'รหัสข้อมูลไม่ถูกต้อง')
  const config = definitions[table]
  const parsed = operation === 'delete' ? null : config.schema.safeParse(Object.fromEntries(config.columns.map(key => [key, formData?.get(key)])))
  if (parsed && !parsed.success) finish(table, 'กรุณาตรวจสอบข้อมูลในฟอร์ม')
  const values = parsed?.success ? parsed.data as Record<string, unknown> : null
  let message: string | undefined
  try {
    message = await withUserDatabase(async tx => {
      if (operation !== 'create') {
        const target = await tx.execute(sql`select id from public.${sql.identifier(table)} where id=${id!} for update`)
        if (!target.rows.length) return 'ไม่พบข้อมูลที่ต้องการเปลี่ยนแปลง'
      }
      if (operation !== 'create' && (operation === 'delete' || values?.is_active === false)) {
        // The row lock pairs with item mutation reference locks, preventing a concurrent attachment.
        const usage = await tx.execute(sql`select id from public.items where ${sql.identifier(config.reference)}=${id!} ${operation === 'delete' ? sql`` : sql`and deleted_at is null`} limit 1`)
        if (usage.rows.length) return 'ข้อมูลนี้กำลังถูกใช้งานโดยพัสดุในระบบ และไม่สามารถลบหรือปิดการใช้งานได้'
      }
      if (operation === 'delete') {
        const deleted = await tx.execute(sql`delete from public.${sql.identifier(table)} where id=${id!} returning id`)
        if (!deleted.rows.length) return 'ไม่พบข้อมูลที่สามารถลบได้'
      } else if (operation === 'create') {
        await tx.execute(sql`insert into public.${sql.identifier(table)} (${sql.join(config.columns.map(key => sql.identifier(key)), sql`, `)}) values (${sql.join(config.columns.map(key => sql`${values![key]}`), sql`, `)})`)
      } else {
        await tx.execute(sql`update public.${sql.identifier(table)} set ${sql.join(config.columns.map(key => sql`${sql.identifier(key)}=${values![key]}`), sql`, `)}, updated_at=now() where id=${id!}`)
      }
      return undefined
    })
  } catch (error) { message = friendlyError(error) }
  if (message === undefined) {
    if (operation === 'create') {
      await writeAuditLog({ operation: 'create', feature: 'settings', userId: profile.id, targetType: table, newValues: values ?? undefined })
    } else if (operation === 'update') {
      await writeAuditLog({ operation: 'update', feature: 'settings', userId: profile.id, targetType: table, targetId: id, newValues: values ?? undefined })
    } else if (operation === 'delete') {
      await writeAuditLog({ operation: 'delete', feature: 'settings', userId: profile.id, targetType: table, targetId: id })
    }
  }
  finish(table, message)
}

export async function updatePostgresSettingsProfile(id: string, formData: FormData): Promise<never> {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || profile.role !== 'admin') finish('users', 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการผู้ใช้ได้')
  if (profile.id === id) finish('users', 'ไม่สามารถแก้ไขโปรไฟล์ของตนเองได้')
  const parsed = z.object({ id: z.string().uuid(), role: z.enum(['admin','staff','viewer']) }).safeParse({ id, role: formData.get('role') })
  if (!parsed.success) finish('users', 'ข้อมูลผู้ใช้ไม่ถูกต้อง')
  const active = formData.get('is_active') === 'on' || formData.get('is_active') === 'true'
  const rate = await checkRateLimit('settings-update-profile', 30, 60000)
  if (!rate.success) finish('users', rate.error!)
  let message: string | undefined
  try {
    const result = await pgUpdateUserProfile(id, { role: parsed.data.role, is_active: active })
    if (!('success' in result) || !result.success) message = 'ไม่สามารถบันทึกโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง'
  } catch (error) { message = friendlyError(error) }
  finish('users', message)
}
