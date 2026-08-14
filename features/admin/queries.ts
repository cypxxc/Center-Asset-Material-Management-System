import { createClient, createAdminClient } from '@/lib/supabase/server'

export interface ProfileListItem {
  id: string
  full_name: string | null
  email: string | null
  role: 'admin' | 'staff' | 'viewer'
  is_active: boolean
  created_at: string
  updated_at: string | null
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
