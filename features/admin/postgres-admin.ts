import 'server-only'
import { sql, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/features/auth/queries'
import { getAuthDatabase, type PostgresTransaction } from '@/lib/postgres/db'
import { withUserDatabase } from '@/lib/postgres/request'
import { hashPassword } from '@/lib/postgres/password'
import { normalizeForStorage } from '@/lib/unicode'
import { assertAdminTable } from './table-policy'
import { assertSelfProtection, backupTables, newUserSchema, pageBounds, parseBusinessBackup, profileUpdateSchema, tableColumns, uuidSchema, writablePayload, type BackupTable } from './postgres-policy'
import type { ProfileListItem, AuditLogListItem } from './types'
import type { GetAuditLogsParams } from './queries'

const denied = 'Access Denied: Admin role required and profile must be active'

async function adminIdentity() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin' || !profile.is_active) throw new Error(denied)
  return profile.id
}

async function withAdmin<T>(work: (tx: PostgresTransaction, actorId: string) => Promise<T>): Promise<T> {
  const actorId = await adminIdentity()
  return withUserDatabase(async (tx) => {
    // Keep the actor's authority stable until this mutation commits.
    const actor = await tx.execute(sql`select id from public.profiles where id = ${actorId}::uuid and role = 'admin' and is_active for share`)
    if (!actor.rows.length) throw new Error(denied)
    return work(tx, actorId)
  })
}

async function withAdminAuth<T>(work: (tx: PostgresTransaction, actorId: string) => Promise<T>): Promise<T> {
  // Never instantiate the privileged database before the verified administrator check.
  const actorId = await adminIdentity()
  return getAuthDatabase().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${actorId}, true)`)
    const actor = await tx.execute(sql`select id from public.profiles where id = ${actorId}::uuid and role = 'admin' and is_active for share`)
    if (!actor.rows.length) throw new Error(denied)
    return work(tx, actorId)
  })
}

function failure(error: unknown): { error: string; success?: never } {
  if (error instanceof Error && error.message === denied) return { error: denied }
  // Drizzle errors contain SQL and parameters; never expose password hashes or database details.
  const cause = error && typeof error === 'object' && 'cause' in error ? error.cause : error
  const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined
  if (code === '23505') return { error: 'มีข้อมูลนี้อยู่ในระบบแล้ว กรุณาตรวจสอบอีเมลหรือรหัสที่ซ้ำกัน' }
  if (code === '23503') return { error: 'ข้อมูลนี้มีความสัมพันธ์กับข้อมูลอื่น หรือไม่พบข้อมูลอ้างอิง' }
  if (code || cause !== error) return { error: 'ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง' }
  if (error instanceof Error && error.name === 'ZodError') return { error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบรูปแบบและค่าที่กรอก' }
  return { error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง' }
}

function invalidate() {
  revalidatePath('/admin/db-panel')
  revalidatePath('/admin/users')
  revalidatePath('/', 'layout')
}

// Every identifier comes from a server-owned allowlist, never from backup data or SQL text.
function tableSql(table: BackupTable) { return sql`${sql.identifier('public')}.${sql.identifier(table)}` }
function valueSql(key: string, value: unknown) {
  if (['sidebar_order'].includes(key)) return sql`${value == null ? null : JSON.stringify(value)}::jsonb`
  return sql`${value}`
}
function assignments(payload: Record<string, unknown>) {
  return sql.join(Object.entries(payload).map(([key, value]) => sql`${sql.identifier(key)} = ${valueSql(key, value)}`), sql`, `)
}
function serializable<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }

export async function pgGetTableData(tableName: string, page = 1, pageSize = 50) {
  try {
    const data = await withAdmin(async tx => {
      const table = assertAdminTable(tableName, 'read')
      const { limit, offset } = pageBounds(page, pageSize)
      const sort = table === 'items' || table === 'audit_logs' ? 'created_at' : 'id'
      const count = await tx.execute(sql`select count(*)::integer as count from ${tableSql(table)}`)
      const rows = await tx.execute(sql`select * from ${tableSql(table)} order by ${sql.identifier(sort)} desc limit ${limit} offset ${offset}`)
      return { data: serializable(rows.rows), count: Number(count.rows[0]?.count ?? 0) }
    })
    return data
  } catch (error) { return { ...failure(error), data: [], count: 0 } }
}

export async function pgUpsertTableRow(tableName: string, rowId: string | null, raw: Record<string, unknown>): Promise<{ success?: boolean; error?: string; data?: Record<string, unknown> }> {
  try {
    await adminIdentity()
    const { table, payload } = writablePayload(tableName, raw)
    if (table === 'profiles') {
      if (!rowId) return { error: 'Use user management to create an account with a password.' }
      const result = await pgUpdateUserProfile(rowId, payload)
      return 'error' in result ? result : { success: true, data: result.profile }
    }
    if (rowId) uuidSchema.parse(rowId)
    const data = await withAdmin(async (tx, actorId) => {
      if (table === 'items') {
        payload.updated_by = actorId
        if (!rowId) payload.created_by = actorId
      }
      const result = rowId
        ? await tx.execute(sql`update ${tableSql(table)} set ${assignments(payload)} where id = ${rowId}::uuid returning *`)
        : await tx.execute(sql`insert into ${tableSql(table)} (${sql.join(Object.keys(payload).map(key => sql.identifier(key)), sql`, `)}) values (${sql.join(Object.entries(payload).map(([key, value]) => valueSql(key, value)), sql`, `)}) returning *`)
      if (!result.rows[0]) throw new Error('ไม่พบข้อมูลที่ต้องการแก้ไข')
      return serializable(result.rows[0])
    })
    invalidate()
    return { success: true, data }
  } catch (error) { return failure(error) }
}

export async function pgDeleteTableRow(tableName: string, rowId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await adminIdentity()
    const table = assertAdminTable(tableName, 'delete')
    uuidSchema.parse(rowId)
    if (table === 'profiles') return pgDeleteAuthUser(rowId)
    if (table === 'audit_logs') throw new Error('Audit history is read-only.')
    await withAdmin(async tx => {
      const result = await tx.execute(sql`delete from ${tableSql(table)} where id = ${rowId}::uuid returning id`)
      if (!result.rows.length) throw new Error('ไม่พบข้อมูลที่ต้องการลบ')
    })
    invalidate()
    return { success: true }
  } catch (error) { return failure(error) }
}

export async function pgCreateAuthUser(raw: { email?: string; password: string; full_name: string; role: 'admin' | 'staff' | 'viewer'; is_active: boolean }): Promise<{ success?: boolean; error?: string; userId?: string }> {
  try {
    await adminIdentity()
    const payload = newUserSchema.parse(raw)
    const fullName = normalizeForStorage(payload.full_name)
    if (!fullName) throw new Error('กรุณากรอกชื่อ-นามสกุล')
    const email = normalizeForStorage(payload.email || `internal+${crypto.randomUUID()}@registry.internal`).toLowerCase()
    const passwordHash = await hashPassword(payload.password)
    const userId = crypto.randomUUID()
    await withAdminAuth(async (tx, actorId) => {
      await tx.execute(sql`insert into public.profiles (id, email, full_name, role, is_active) values (${userId}::uuid, ${email}, ${fullName}, ${payload.role}, ${payload.is_active})`)
      await tx.execute(sql`insert into private_auth.credentials (user_id, password_hash) values (${userId}::uuid, ${passwordHash})`)
      await tx.execute(sql`select private_auth.record_admin_event(${actorId}::uuid, ${userId}::uuid, 'create_user')`)
    })
    invalidate()
    return { success: true, userId }
  } catch (error) { return failure(error) }
}

export async function pgDeleteAuthUser(userId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    uuidSchema.parse(userId)
    await withAdminAuth(async (tx, actorId) => {
      assertSelfProtection(actorId, userId, {}, true)
      const result = await tx.execute(sql`delete from public.profiles where id = ${userId}::uuid returning id`)
      if (!result.rows.length) throw new Error('ไม่พบผู้ใช้งาน')
      // FK cascades revoke sessions and remove credentials in the same transaction.
      await tx.execute(sql`select private_auth.record_admin_event(${actorId}::uuid, ${userId}::uuid, 'delete_user')`)
    })
    invalidate()
    return { success: true }
  } catch (error) { return failure(error) }
}

export async function pgResetAuthPassword(userId: string, password: string): Promise<{ success?: boolean; error?: string }> {
  try {
    await adminIdentity()
    uuidSchema.parse(userId)
    if (typeof password !== 'string' || password.length < 6 || password.length > 1024) throw new Error('รหัสผ่านใหม่ต้องมี 6 ถึง 1,024 ตัวอักษร')
    const passwordHash = await hashPassword(password)
    await withAdminAuth(async (tx, actorId) => {
      // Login holds this same lock while checking credentials and issuing a session.
      await tx.execute(sql`select id from public.profiles where id = ${userId}::uuid for update`)
      const result = await tx.execute(sql`update private_auth.credentials set password_hash = ${passwordHash} where user_id = ${userId}::uuid returning user_id`)
      if (!result.rows.length) throw new Error('ไม่พบผู้ใช้งาน')
      await tx.execute(sql`delete from private_auth.sessions where user_id = ${userId}::uuid`)
      await tx.execute(sql`select private_auth.record_admin_event(${actorId}::uuid, ${userId}::uuid, 'RESET_PASSWORD')`)
    })
    invalidate()
    return { success: true }
  } catch (error) { return failure(error) }
}

export async function pgUpdateUserEmail(userId: string, email: string): Promise<{ success?: boolean; error?: string; data?: Record<string, unknown> }> {
  try {
    uuidSchema.parse(userId)
    const value = newUserSchema.shape.email.parse(normalizeForStorage(email || '').toLowerCase())
    if (!value) throw new Error('กรุณาระบุรูปแบบอีเมลให้ถูกต้อง')
    const data = await withAdminAuth(async (tx, actorId) => {
      const result = await tx.execute(sql`update public.profiles set email = ${value}, updated_at = now() where id = ${userId}::uuid returning id, email`)
      if (!result.rows[0]) throw new Error('ไม่พบผู้ใช้งาน')
      await tx.execute(sql`delete from private_auth.sessions where user_id = ${userId}::uuid`)
      await tx.execute(sql`select private_auth.record_admin_event(${actorId}::uuid, ${userId}::uuid, 'update_user')`)
      return serializable(result.rows[0])
    })
    invalidate()
    return { success: true, data }
  } catch (error) { return failure(error) }
}

export async function pgUpdateUserProfile(userId: string, raw: { role?: 'admin' | 'staff' | 'viewer'; is_active?: boolean; full_name?: string } | Record<string, unknown>): Promise<{ success?: boolean; error?: string; profile?: Record<string, unknown> }> {
  try {
    uuidSchema.parse(userId)
    const payload = profileUpdateSchema.parse(raw)
    if (payload.full_name !== undefined) {
      payload.full_name = normalizeForStorage(payload.full_name)
      if (!payload.full_name) throw new Error('กรุณากรอกชื่อ-นามสกุล')
    }
    if (!Object.keys(payload).length) throw new Error('No editable fields were supplied.')
    const profile = await withAdminAuth(async (tx, actorId) => {
      assertSelfProtection(actorId, userId, payload)
      const result = await tx.execute(sql`update public.profiles set ${assignments(payload)}, updated_at = now() where id = ${userId}::uuid returning *`)
      if (!result.rows[0]) throw new Error('ไม่พบผู้ใช้งาน')
      if (payload.role !== undefined || payload.is_active !== undefined) await tx.execute(sql`delete from private_auth.sessions where user_id = ${userId}::uuid`)
      await tx.execute(sql`select private_auth.record_admin_event(${actorId}::uuid, ${userId}::uuid, 'update_user')`)
      return serializable(result.rows[0])
    })
    invalidate()
    return { success: true, profile }
  } catch (error) { return failure(error) }
}

export async function pgExportDatabaseData() {
  try {
    const backup = await withAdmin(async tx => {
      // One MVCC snapshot across every table; never export credentials or sessions.
      const results = await tx.execute(sql`select ${sql.join(backupTables.map(table => sql`(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from ${tableSql(table)} t) as ${sql.identifier(table)}`), sql`, `)}`)
      return { __meta: { version: 1, exportedAt: new Date().toISOString(), tables: backupTables, scope: 'business', identitiesRestored: false }, ...results.rows[0] }
    })
    return { backup, error: undefined }
  } catch (error) { return { ...failure(error), backup: null } }
}

export async function pgImportDatabaseData(source: string) {
  try {
    await adminIdentity()
    const backup = parseBusinessBackup(source)
    const tables: BackupTable[] = ['categories', 'locations', 'units', 'items']
    await withAdmin(async tx => {
      // Lock all restored tables together to serialize against concurrent edits/number allocation.
      await tx.execute(sql`lock table public.items, public.categories, public.locations, public.units in share row exclusive mode`)
      for (const table of [...tables].reverse()) await tx.execute(sql`delete from ${tableSql(table)}`)
      for (const table of tables) {
        if (!backup[table].length) continue
        const columns = sql.join(tableColumns[table].map(key => sql.identifier(key)), sql`, `)
        // Accounts are preserved, so historical authors deleted since export become null.
        // Foreign keys for business records still fail and roll back the complete restore.
        const values = sql.join(tableColumns[table].map(key => {
          const source = sql`${sql.identifier('restored')}.${sql.identifier(key)}`
          return table === 'items' && ['created_by', 'updated_by', 'deleted_by'].includes(key)
            ? sql`(select id from public.profiles where id = ${source})`
            : source
        }), sql`, `)
        await tx.execute(sql`insert into ${tableSql(table)} (${columns}) select ${values} from jsonb_populate_recordset(null::${tableSql(table)}, ${JSON.stringify(backup[table])}::jsonb) as restored`)
      }
      await tx.execute(sql`insert into public.audit_logs (user_id, action, target_table, new_data) values (current_setting('app.user_id')::uuid, 'backup_restore', 'business_backup', ${JSON.stringify({ tables, identitiesRestored: false })}::jsonb)`)
    })
    invalidate()
    return { success: true, tablesRestored: tables, error: undefined }
  } catch (error) { return failure(error) }
}

export async function pgGetProfilesList(params: { q?: string; role?: string; is_active?: string; page?: number; pageSize?: number }) {
  try {
    return await withAdmin(async tx => {
      const filters: SQL[] = [sql`true`]
      if (params.q) filters.push(sql`(full_name ilike ${'%' + params.q + '%'} or email ilike ${'%' + params.q + '%'})`)
      if (params.role && params.role !== 'all') filters.push(sql`role = ${params.role}`)
      if (params.is_active && params.is_active !== 'all') filters.push(sql`is_active = ${params.is_active === 'true'}`)
      const where = sql.join(filters, sql` and `)
      const { limit, offset } = pageBounds(params.page, params.pageSize)
      const count = await tx.execute(sql`select count(*)::integer as count from public.profiles where ${where}`)
      const rows = await tx.execute(sql`select id, full_name, email, role, is_active, created_at, updated_at from public.profiles where ${where} order by created_at desc, id limit ${limit} offset ${offset}`)
      return { profiles: serializable(rows.rows) as unknown as ProfileListItem[], totalCount: Number(count.rows[0]?.count ?? 0), error: undefined }
    })
  } catch (error) { return { ...failure(error), profiles: [] as ProfileListItem[], totalCount: 0 } }
}

export async function pgGetAuditLogsList(params: GetAuditLogsParams) {
  try {
    return await withAdmin(async tx => {
      const filters: SQL[] = [sql`true`]
      if (params.action && params.action !== 'all') filters.push(sql`lower(a.action) = ${params.action.toLowerCase()}`)
      if (params.target_table && params.target_table !== 'all') filters.push(sql`a.target_table = ${params.target_table}`)
      if (params.q?.trim()) {
        const term = params.q.trim()
        filters.push(sql`(a.target_id::text = ${term} or a.target_table ilike ${'%' + term + '%'} or a.action ilike ${'%' + term + '%'})`)
      }
      const where = sql.join(filters, sql` and `)
      const { limit, offset } = pageBounds(params.page, params.pageSize)
      const count = await tx.execute(sql`select count(*)::integer as count from public.audit_logs a where ${where}`)
      const rows = await tx.execute(sql`select a.*, coalesce(p.full_name, 'ระบบอัตโนมัติ') as actor_name, p.email as actor_email, p.role as actor_role, case when p.id is null then null else jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', p.role) end as profiles from public.audit_logs a left join public.profiles p on p.id = a.user_id where ${where} order by a.created_at desc, a.id limit ${limit} offset ${offset}`)
      return { logs: serializable(rows.rows) as unknown as AuditLogListItem[], totalCount: Number(count.rows[0]?.count ?? 0), error: undefined }
    })
  } catch (error) { return { ...failure(error), logs: [] as AuditLogListItem[], totalCount: 0 } }
}
