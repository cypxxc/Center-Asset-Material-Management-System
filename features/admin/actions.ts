'use server'

import { getCurrentProfile } from '@/features/auth/queries'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath, revalidateTag } from 'next/cache'

async function getSupabaseClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim() !== '') {
    return createAdminClient()
  }
  return createClient()
}

export async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin') {
    return { error: 'Access Denied: Admin role required' }
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
      revalidateTag('references-tag', 'max')
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
      revalidateTag('references-tag', 'max')
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
    revalidateTag('references-tag', 'max')
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
