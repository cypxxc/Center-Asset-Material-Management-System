import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/features/auth/queries'

export interface ProfileListItem {
  id: string
  full_name: string | null
  email: string | null
  role: 'admin' | 'staff' | 'viewer'
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface AuditLogListItem {
  id: string
  user_id: string | null
  action: string
  target_table: string
  target_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
  actor_name?: string | null
  actor_email?: string | null
  actor_role?: string | null
  profiles?: {
    id?: string
    full_name?: string | null
    email?: string | null
    role?: string | null
  } | null
}

export interface GetAuditLogsParams {
  q?: string
  action?: string
  target_table?: string
  page?: number
  pageSize?: number
}

export async function getProfilesList(params: {
  q?: string
  role?: string
  is_active?: string
  page?: number
  pageSize?: number
} = {}) {
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? await createAdminClient() : await createClient()
  const page = params.page || 1
  const pageSize = params.pageSize || 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (params.q) {
    query = query.or(`full_name.ilike.%${params.q}%,email.ilike.%${params.q}%`)
  }
  if (params.role && params.role !== 'all') {
    query = query.eq('role', params.role)
  }
  if (params.is_active !== undefined && params.is_active !== 'all') {
    query = query.eq('is_active', params.is_active === 'true')
  }

  const { data, count, error } = await query.range(from, to)
  return {
    profiles: (data as ProfileListItem[]) || [],
    totalCount: count || 0,
    error: error ? (error as { message?: string }).message || String(error) : undefined,
  }
}

export async function getAuditLogsList(params: GetAuditLogsParams = {}) {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return {
      logs: [] as AuditLogListItem[],
      totalCount: 0,
      error: 'Access Denied: Admin role required and profile must be active',
    }
  }

  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY ? await createAdminClient() : await createClient()
  const page = params.page || 1
  const pageSize = params.pageSize || 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('audit_logs')
    .select(`
      id,
      user_id,
      action,
      target_table,
      target_id,
      old_data,
      new_data,
      created_at,
      profiles:user_id(id, full_name, email, role)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (params.action && params.action !== 'all') {
    query = query.eq('action', params.action)
  }

  if (params.target_table && params.target_table !== 'all') {
    query = query.eq('target_table', params.target_table)
  }

  if (params.q && params.q.trim() !== '') {
    const searchTerm = params.q.trim()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTerm)
    if (isUuid) {
      query = query.or(`target_id.eq.${searchTerm},target_table.ilike.%${searchTerm}%`)
    } else {
      query = query.or(`target_table.ilike.%${searchTerm}%,action.ilike.%${searchTerm}%`)
    }
  }

  const { data, count, error } = await query.range(from, to)

  interface RawAuditLogRow {
    id: string
    user_id: string | null
    action: string
    target_table: string
    target_id: string | null
    old_data: Record<string, unknown> | null
    new_data: Record<string, unknown> | null
    created_at: string
    profiles: { id?: string; full_name?: string | null; email?: string | null; role?: string | null } | { id?: string; full_name?: string | null; email?: string | null; role?: string | null }[] | null
  }

  const logs: AuditLogListItem[] = ((data || []) as unknown as RawAuditLogRow[]).map((row) => {
    const profileObj = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      id: row.id,
      user_id: row.user_id,
      action: row.action,
      target_table: row.target_table,
      target_id: row.target_id,
      old_data: row.old_data as Record<string, unknown> | null,
      new_data: row.new_data as Record<string, unknown> | null,
      created_at: row.created_at,
      actor_name: profileObj?.full_name || 'ระบบอัตโนมัติ',
      actor_email: profileObj?.email || null,
      actor_role: profileObj?.role || null,
      profiles: profileObj || null,
    }
  })

  return {
    logs,
    totalCount: count || 0,
    error: error ? (error as { message?: string }).message || String(error) : undefined,
  }
}
