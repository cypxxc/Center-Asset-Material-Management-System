'use server'

import { getCurrentProfile } from '@/features/auth/queries'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { clearReferencesCache } from '@/features/items/queries'

const isDev = process.env.NODE_ENV !== 'production'

async function getSupabaseClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim() !== '') {
    return createAdminClient()
  }
  return createClient()
}

export async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (isDev) console.debug('requireAdmin: current profile=', profile)
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    if (isDev) console.warn('requireAdmin: access denied for profile=', profile)
    return { error: 'Access Denied: Admin role required and profile must be active' }
  }
  return { profile }
}

export async function getTableData(tableName: string, page: number = 1, pageSize: number = 50) {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error, data: [], count: 0 }

  const supabase = await getSupabaseClient()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Handle audit_logs sorting by created_at, others can sort by name or created_at if exists
  const sortBy = tableName === 'audit_logs' || tableName === 'items' ? 'created_at' : 'id'

  const { data, error, count } = await supabase
    .from(tableName)
    .select('*', { count: 'exact' })
    .order(sortBy, { ascending: false })
    .range(from, to)

  if (error) return { error: error.message, data: [], count: 0 }
  return { data: data || [], count: count || 0 }
}

export async function upsertTableRow(tableName: string, rowId: string | null, payload: Record<string, unknown>) {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  const supabase = await getSupabaseClient()

  // Clean up payload fields that are empty or shouldn't be edited directly
  const cleanPayload = { ...payload }
  delete cleanPayload.id
  delete cleanPayload.created_at
  delete cleanPayload.updated_at
  delete cleanPayload.deleted_at

  // Normalize empty strings to null for nullable database columns
  for (const key in cleanPayload) {
    if (cleanPayload[key] === '') {
      cleanPayload[key] = null
    }
  }

  if (rowId) {
    // Update
    const { data, error } = await supabase
      .from(tableName)
      .update(cleanPayload)
      .eq('id', rowId)
      .select()

    if (error) return { error: error.message }
    
    // Log in audit log
    await supabase.from('audit_logs').insert({
      user_id: auth.profile.id,
      action: 'UPDATE',
      target_table: tableName,
      target_id: rowId,
      new_data: cleanPayload
    })

    if (['categories', 'locations', 'units'].includes(tableName)) {
      clearReferencesCache()
    }

    revalidatePath('/admin/db-panel')
    return { success: true, data: data?.[0] }
  } else {
    // Insert
    const { data, error } = await supabase
      .from(tableName)
      .insert(cleanPayload)
      .select()

    if (error) return { error: error.message }

    const newId = data?.[0]?.id

    // Log in audit log
    if (newId) {
      await supabase.from('audit_logs').insert({
        user_id: auth.profile.id,
        action: 'INSERT',
        target_table: tableName,
        target_id: newId,
        new_data: cleanPayload
      })
    }

    if (['categories', 'locations', 'units'].includes(tableName)) {
      clearReferencesCache()
    }

    revalidatePath('/admin/db-panel')
    return { success: true, data: data?.[0] }
  }
}

export async function deleteTableRow(tableName: string, rowId: string) {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  const supabase = await getSupabaseClient()

  // Fetch old data for audit log first
  const { data: oldRow } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', rowId)
    .single()

  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('id', rowId)

  if (error) return { error: error.message }

  // Log in audit log
  await supabase.from('audit_logs').insert({
    user_id: auth.profile.id,
    action: 'DELETE',
    target_table: tableName,
    target_id: rowId,
    old_data: oldRow || null
  })

  if (['categories', 'locations', 'units'].includes(tableName)) {
    clearReferencesCache()
  }

  revalidatePath('/admin/db-panel')
  return { success: true }
}

export async function runAdminSql(sqlQuery: string) {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  const supabase = await getSupabaseClient()
  const { data, error } = await supabase.rpc('exec_admin_sql', { sql_query: sqlQuery })

  if (error) {
    return { error: error.message }
  }

  // Log SQL execution in audit_logs
  await supabase.from('audit_logs').insert({
    user_id: auth.profile.id,
    action: 'SQL_EXECUTE',
    target_table: 'multiple/raw_sql',
    new_data: { query: sqlQuery }
  })

  return data
}

export async function exportDatabaseData() {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error, backup: null }

  const supabase = await getSupabaseClient()
  const tables = ['profiles', 'categories', 'locations', 'units', 'items', 'audit_logs']
  const backup: Record<string, Record<string, unknown>[]> = {}

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*')
    if (!error && data) {
      backup[table] = data
    }
  }

  return { backup }
}

export async function importDatabaseData(backupJsonStr: string) {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  const supabase = await getSupabaseClient()
  try {
    const backup = JSON.parse(backupJsonStr)
    const tables = ['profiles', 'categories', 'locations', 'units', 'items', 'audit_logs']

    for (const table of tables) {
      const rows = backup[table]
      if (Array.isArray(rows) && rows.length > 0) {
        const { error } = await supabase
          .from(table)
          .upsert(rows, { onConflict: 'id' })

        if (error) {
          return { error: `Failed to restore table ${table}: ${error.message}` }
        }
      }
    }

    // Log restore action
    await supabase.from('audit_logs').insert({
      user_id: auth.profile.id,
      action: 'DATABASE_RESTORE',
      target_table: 'all',
      new_data: { tables_restored: Object.keys(backup) }
    })

    return { success: true }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return { error: 'Invalid backup file format: ' + errMsg }
  }
}

// ============================================================
// Create Auth User + Profile in one atomic action
// ============================================================

export async function createAuthUser(payload: {
  email?: string
  password: string
  full_name: string
  role: 'admin' | 'staff' | 'viewer'
  is_active: boolean
}) {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { error: 'ต้องตั้งค่า SUPABASE_SERVICE_ROLE_KEY เพื่อสร้างผู้ใช้ใหม่' }
  }

  const adminClient = await createAdminClient()

  // Basic server-side validation
  let email = (payload.email || '').trim()
  const password = payload.password || ''
  const full_name = (payload.full_name || '').trim()
  const role = payload.role
  const is_active = payload.is_active !== false

  const emailRegex = /^\S+@\S+\.\S+$/
  // If email not provided, generate an internal placeholder email
  if (!email) {
    const random = Math.random().toString(36).slice(2, 10)
    email = `internal+${Date.now()}.${random}@registry.internal`
  } else if (!emailRegex.test(email)) {
    return { error: 'อีเมลไม่ถูกต้อง' }
  }
  if (!full_name) {
    return { error: 'กรุณากรอกชื่อ-นามสกุล' }
  }
  if (!password || password.length < 6) {
    return { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }
  }
  if (!['admin', 'staff', 'viewer'].includes(role)) {
    return { error: 'บทบาทไม่ถูกต้อง' }
  }

  try {
    // Check for existing profile with same email to provide clearer error
    const { data: existingProfiles, error: existingErr } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1)

    if (existingErr) {
      return { error: `ตรวจสอบอีเมลล้มเหลว: ${existingErr.message}` }
    }
    if (Array.isArray(existingProfiles) && existingProfiles.length > 0) {
      return { error: 'อีเมลนี้มีอยู่ในระบบแล้ว' }
    }

    // Step 1: Create auth user via Supabase Auth Admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData?.user) {
      if (isDev) console.error('createAuthUser: auth.admin.createUser error', authError)
      return { error: authError?.message ?? 'สร้างผู้ใช้ใน Auth ล้มเหลว' }
    }

    const userId = authData.user.id

    // Step 2: Upsert profile linked to the new auth user UUID
    // Use upsert with onConflict 'id' to avoid duplicate primary key errors
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert([
        {
          id: userId,
          email,
          full_name,
          role,
          is_active,
        }
      ], { onConflict: 'id' })

    if (profileError) {
      if (isDev) console.error('createAuthUser: upsert profile error', profileError)
      // Rollback: delete the auth user we just created
      try {
        await adminClient.auth.admin.deleteUser(userId)
      } catch (delErr) {
        return { error: `สร้าง/อัปเดต Profile ล้มเหลว: ${profileError.message} (และไม่สามารถลบ Auth user: ${String(delErr)})` }
      }
      return { error: `สร้าง/อัปเดต Profile ล้มเหลว (ยกเลิก Auth User แล้ว): ${profileError.message}` }
    }

    // Log in audit_logs
    await adminClient.from('audit_logs').insert({
      user_id: auth.profile.id,
      action: 'CREATE_USER',
      target_table: 'profiles',
      target_id: userId,
      new_data: { email, full_name, role },
    })

    revalidatePath('/admin/db-panel')
    return { success: true, userId }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return { error: 'เกิดข้อผิดพลาดขณะสร้างผู้ใช้: ' + errMsg }
  }
}

// ============================================================
// Delete Auth User (hard delete from both auth.users + profiles)
// ============================================================

export async function deleteAuthUser(userId: string) {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { error: 'ต้องตั้งค่า SUPABASE_SERVICE_ROLE_KEY เพื่อลบผู้ใช้' }
  }

  const adminClient = await createAdminClient()

  // Delete from auth.users (cascades to profiles if FK is set, or manual below)
  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId)
  if (authDeleteError) return { error: authDeleteError.message }

  // Hard-delete the profile row (safety net if FK doesn't cascade)
  await adminClient.from('profiles').delete().eq('id', userId)

  await adminClient.from('audit_logs').insert({
    user_id: auth.profile.id,
    action: 'DELETE_USER',
    target_table: 'profiles',
    target_id: userId,
  })

  revalidatePath('/admin/db-panel')
  return { success: true }
}

// ============================================================
// Reset Auth User password (admin)
// ============================================================

export async function resetAuthPassword(userId: string, newPassword: string) {
  const auth = await requireAdmin()
  if (auth.error) return { error: auth.error }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return { error: 'ต้องตั้งค่า SUPABASE_SERVICE_ROLE_KEY เพื่อรีเซ็ตรหัสผ่าน' }
  }

  if (!newPassword || newPassword.length < 6) {
    return { error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' }
  }

  const adminClient = await createAdminClient()

  try {
    const { data, error } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
      email_confirm: true,
    })

    if (error) {
      if (isDev) console.error('resetAuthPassword: updateUserById error', error)
      return { error: error.message }
    }

    await adminClient.from('audit_logs').insert({
      user_id: auth.profile.id,
      action: 'RESET_PASSWORD',
      target_table: 'profiles',
      target_id: userId,
      new_data: { note: 'Password reset by admin' }
    })

    revalidatePath('/admin/db-panel')
    return { success: true, data }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    if (isDev) console.error('resetAuthPassword: unexpected error', err)
    return { error: 'เกิดข้อผิดพลาดขณะรีเซ็ตรหัสผ่าน: ' + errMsg }
  }
}
