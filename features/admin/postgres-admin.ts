import 'server-only'
import { sql, type SQL } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/features/auth/queries'
import { getAuthDatabase, type PostgresTransaction } from '@/lib/postgres/db'
import { withUserDatabase } from '@/lib/postgres/request'
import { hashPassword } from '@/lib/postgres/password'
import { normalizeForStorage } from '@/lib/unicode'
import { assertAdminTable } from './table-policy'
import { archivePostgresItems } from '@/features/items/archive-items'
import { assertSelfProtection, backupTables, newUserSchema, pageBounds, parseBusinessBackup, profileUpdateSchema, searchColumns, tableColumns, uuidSchema, writablePayload, type BackupTable } from './postgres-policy'
import type { ProfileListItem, AuditLogListItem } from './types'
import type { GetAuditLogsParams } from './queries'
import { buildAuditActionFilter } from './audit-action-filter'

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

export async function pgGetTableData(tableName: string, page = 1, pageSize = 50, search = '') {
  try {
    const data = await withAdmin(async tx => {
      const table = assertAdminTable(tableName, 'read')
      const { limit, offset } = pageBounds(page, pageSize)
      const sort = table === 'items' || table === 'audit_logs' ? 'created_at' : 'id'
      const term = (search || '').trim()
      const cols = searchColumns[table] || []
      const whereClause = term && cols.length > 0
        ? sql` where ${sql.join(cols.map(c => sql`coalesce(${sql.identifier(c)}::text, '') ilike ${'%' + term + '%'}`), sql` or `)}`
        : sql``
      const count = await tx.execute(sql`select count(*)::integer as count from ${tableSql(table)}${whereClause}`)
      const rows = await tx.execute(sql`select * from ${tableSql(table)}${whereClause} order by ${sql.identifier(sort)} desc limit ${limit} offset ${offset}`)
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
    await withAdmin(async (tx, actorId) => {
      if (table === 'items' || table === 'materials') {
        const itemType = table === 'items' ? 'asset' : 'material'
        const archived = await archivePostgresItems(tx, [rowId], actorId, itemType)
        if (!archived.length) throw new Error('ไม่พบข้อมูลที่ต้องการลบหรือข้อมูลถูกลบไปแล้ว')
        await tx.execute(sql`
          INSERT INTO public.audit_logs (user_id, action, target_table, target_id, new_data)
          VALUES (${actorId}::uuid, 'DELETE_ITEM', ${table}, ${rowId}::uuid,
            ${JSON.stringify({ operation: 'soft_delete', source: 'admin_table' })}::jsonb)
        `)
      } else {
        const result = await tx.execute(sql`delete from ${tableSql(table)} where id = ${rowId}::uuid returning id`)
        if (!result.rows.length) throw new Error('ไม่พบข้อมูลที่ต้องการลบ')
        await tx.execute(sql`
          INSERT INTO public.audit_logs (user_id, action, target_table, target_id, new_data)
          VALUES (${actorId}::uuid, 'DELETE_ROW', ${table}, ${rowId}::uuid,
            ${JSON.stringify({ table, rowId })}::jsonb)
        `)
      }
    })
    invalidate()
    return { success: true }
  } catch (error) { return failure(error) }
}

export async function pgCreateAuthUser(raw: { email?: string | null; password: string; full_name: string; role: 'admin' | 'user'; is_active: boolean }): Promise<{ success?: boolean; error?: string; userId?: string }> {
  try {
    await adminIdentity()
    const payload = newUserSchema.parse(raw)
    const fullName = normalizeForStorage(payload.full_name)
    if (!fullName) throw new Error('กรุณากรอกชื่อ-นามสกุล')
    const email = payload.email ? normalizeForStorage(payload.email).toLowerCase() : null
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
      const target = await tx.execute(sql`select role, is_active from public.profiles where id = ${userId}::uuid for update`)
      if (!target.rows.length) throw new Error('ไม่พบผู้ใช้งาน')
      if (target.rows[0].role === 'admin' && target.rows[0].is_active) {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext('camms_admin_protection'))`); const countRes = await tx.execute(sql`select count(*)::int as count from public.profiles where role = 'admin' and is_active = true`)
        if (Number(countRes.rows[0]?.count ?? 0) <= 1) throw new Error('ไม่สามารถลบผู้ดูแลระบบคนสุดท้ายได้')
      }
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

export async function pgUpdateUserProfile(userId: string, raw: { role?: 'admin' | 'user' | 'staff'; is_active?: boolean; full_name?: string } | Record<string, unknown>): Promise<{ success?: boolean; error?: string; profile?: Record<string, unknown> }> {
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
      if (payload.is_active === false || (payload.role && payload.role !== 'admin')) {
        const target = await tx.execute(sql`select role, is_active from public.profiles where id = ${userId}::uuid for update`)
        if (target.rows.length && target.rows[0].role === 'admin' && target.rows[0].is_active) {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtext('camms_admin_protection'))`); const countRes = await tx.execute(sql`select count(*)::int as count from public.profiles where role = 'admin' and is_active = true`)
          if (Number(countRes.rows[0]?.count ?? 0) <= 1) throw new Error('ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน')
        }
      }
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
      const results = await tx.execute(sql`select ${sql.join(backupTables.map(table => {
        // The owner-only password input is not part of the business backup format.
        const row = table === 'profiles' ? sql`to_jsonb(t) - 'password'` : sql`to_jsonb(t)`
        return sql`(select coalesce(jsonb_agg(${row}), '[]'::jsonb) from ${tableSql(table)} t) as ${sql.identifier(table)}`
      }), sql`, `)}`)
      return { __meta: { version: 1, exportedAt: new Date().toISOString(), tables: backupTables, scope: 'business', identitiesRestored: false }, ...results.rows[0] }
    })
    return { backup, error: undefined }
  } catch (error) { return { ...failure(error), backup: null } }
}

export async function pgImportDatabaseData(source: string) {
  try {
    await adminIdentity()
    const backup = parseBusinessBackup(source)
    const tables: BackupTable[] = ['categories', 'locations', 'units', 'items', 'materials']
    await withAdmin(async tx => {
      // Lock all restored tables and transactional tables together to serialize against concurrent edits and transactions.
      await tx.execute(sql`lock table public.items, public.materials, public.categories, public.locations, public.units, public.disbursements, public.disbursement_items in share row exclusive mode`)

      // Preflight check: refuse import if active transaction history references inventory records
      const historyCheck = await tx.execute<{ count: number }>(sql`
        SELECT (
          (SELECT count(*)::int FROM public.disbursement_items) +
          (SELECT count(*)::int FROM public.stock_movements) +
          (SELECT count(*)::int FROM public.material_stock_documents) +
          (SELECT count(*)::int FROM public.asset_custody_logs)
        ) AS count
      `)
      if (Number(historyCheck.rows[0]?.count ?? 0) > 0) {
        throw new Error('ไม่สามารถนำเข้าข้อมูลสำรองทับได้ เนื่องจากระบบมีประวัติการเบิกจ่าย การยืม-คืน หรือการเคลื่อนไหวสต็อกแล้ว กรุณาใช้การกู้คืนฐานข้อมูลระดับเซิร์ฟเวอร์ (Full Database Restore) แทน')
      }

      for (const table of [...tables].reverse()) await tx.execute(sql`delete from ${tableSql(table)}`)
      for (const table of tables) {
        if (!backup[table].length) continue
        const columns = sql.join(tableColumns[table].map(key => sql.identifier(key)), sql`, `)
        // Accounts are preserved, so historical authors deleted since export become null.
        // Foreign keys for business records still fail and roll back the complete restore.
        const values = sql.join(tableColumns[table].map(key => {
          const source = sql`${sql.identifier('restored')}.${sql.identifier(key)}`
          return (table === 'items' || table === 'materials') && ['created_by', 'updated_by', 'deleted_by'].includes(key)
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
      const actionFilter = buildAuditActionFilter(params.action)
      if (actionFilter) filters.push(actionFilter)
      if (params.target_table && params.target_table !== 'all') filters.push(sql`a.target_table = ${params.target_table}`)
      if (params.q?.trim()) {
        const term = params.q.trim()
        if (params.action === 'custody_history') {
          const pattern = '%' + term + '%'
          filters.push(sql`(
            a.target_id::text = ${term}
            or a.target_table ilike ${pattern}
            or a.action ilike ${pattern}
            or a.new_data->>'item_name' ilike ${pattern}
            or a.new_data->>'asset_no' ilike ${pattern}
            or a.new_data->>'responsible_person' ilike ${pattern}
            or a.old_data->>'responsible_person' ilike ${pattern}
            or a.new_data->>'previous_custodian' ilike ${pattern}
            or p.full_name ilike ${pattern}
          )`)
        } else {
          filters.push(sql`(a.target_id::text = ${term} or a.target_table ilike ${'%' + term + '%'} or a.action ilike ${'%' + term + '%'})`)
        }
      }
      const where = sql.join(filters, sql` and `)
      const { limit, offset } = pageBounds(params.page, params.pageSize)
      const count = await tx.execute(sql`select count(*)::integer as count from public.audit_logs a left join public.profiles p on p.id = a.user_id where ${where}`)
      const rows = await tx.execute(sql`
        select a.*,
          coalesce(p.full_name, 'ระบบอัตโนมัติ') as actor_name,
          p.email as actor_email,
          p.role as actor_role,
          case when p.id is null then null else jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', p.role) end as profiles,
          CASE
            WHEN a.action = 'RETURN_CUSTODY' THEN 'returned'
            WHEN nl.action = 'RETURN_CUSTODY' THEN 'returned'
            WHEN nl.action = 'ASSIGN_CUSTODY' THEN 'transferred'
            WHEN i.id IS NULL OR i.deleted_at IS NOT NULL THEN 'cancelled'
            WHEN coalesce(i.is_central, false) = false
              AND i.responsible_person IS NOT NULL
              AND i.responsible_person = (a.new_data->>'responsible_person') THEN 'can_return'
            WHEN i.responsible_person IS NOT NULL
              AND i.responsible_person != (a.new_data->>'responsible_person') THEN 'transferred'
            ELSE 'completed'
          END AS status_action
        from public.audit_logs a
        left join public.items i on i.id = a.target_id
        left join public.profiles p on p.id = a.user_id
        left join lateral (
          select a2.action
          from public.audit_logs a2
          where a2.target_table = 'items'
            and a2.target_id = a.target_id
            and a2.action in ('ASSIGN_CUSTODY', 'RETURN_CUSTODY')
            and (a2.created_at > a.created_at or (a2.created_at = a.created_at and a2.id > a.id))
          order by a2.created_at asc, a2.id asc
          limit 1
        ) nl on true
        where ${where}
        order by a.created_at desc, a.id limit ${limit} offset ${offset}
      `)
      return { logs: serializable(rows.rows) as unknown as AuditLogListItem[], totalCount: Number(count.rows[0]?.count ?? 0), error: undefined }
    })
  } catch (error) { return { ...failure(error), logs: [] as AuditLogListItem[], totalCount: 0 } }
}
