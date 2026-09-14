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
