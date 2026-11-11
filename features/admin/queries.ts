import 'server-only'
import { getCurrentProfile } from '@/features/auth/queries'
import { pgGetProfilesList, pgGetAuditLogsList } from './postgres-admin'
import type { ProfileListItem, AuditLogListItem, UsersPageData, UsersPageSearchParams, AuditLogsPageData, AuditLogsPageSearchParams } from './types'

export interface GetAuditLogsParams { q?: string; action?: string; target_table?: string; page?: number; pageSize?: number }

export async function getProfilesList(params: { q?: string; role?: string; is_active?: string; page?: number; pageSize?: number } = {}) {
  return pgGetProfilesList(params) as Promise<{ profiles: ProfileListItem[]; totalCount: number; error?: string }>
}

export async function getAuditLogsList(params: GetAuditLogsParams = {}) {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || profile.role !== 'admin') return { logs: [] as AuditLogListItem[], totalCount: 0, error: 'Admin role required' }
  return pgGetAuditLogsList(params) as Promise<{ logs: AuditLogListItem[]; totalCount: number; error?: string }>
}

export async function getUsersPageData(raw: UsersPageSearchParams = {}): Promise<UsersPageData> {
  const page = parseInt(raw.page || '1', 10) || 1
  const pageSize = parseInt(raw.pageSize || '50', 10) || 50
  const data = await getProfilesList({ q: raw.q, role: raw.role, is_active: raw.is_active, page, pageSize })
  return { profiles: data.profiles, totalCount: data.totalCount, searchParams: { q: raw.q || '', role: raw.role || 'all', is_active: raw.is_active || 'all', page, pageSize } }
}

export async function getAuditLogsPageData(raw: AuditLogsPageSearchParams = {}): Promise<AuditLogsPageData> {
  const page = parseInt(raw.page || '1', 10) || 1
  const pageSize = parseInt(raw.pageSize || '50', 10) || 50
  const data = await getAuditLogsList({ q: raw.q, action: raw.action, target_table: raw.target_table, page, pageSize })
  return { logs: data.logs, totalCount: data.totalCount, searchParams: { q: raw.q || '', action: raw.action || 'all', target_table: raw.target_table || 'all', page, pageSize } }
}
