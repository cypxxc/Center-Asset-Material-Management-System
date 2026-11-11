'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin as requireAdminGuard } from '@/features/auth/guards'
import { pgGetTableData, pgUpsertTableRow, pgDeleteTableRow, pgExportDatabaseData, pgImportDatabaseData, pgCreateAuthUser, pgDeleteAuthUser, pgResetAuthPassword, pgUpdateUserEmail, pgUpdateUserProfile } from './postgres-admin'

export async function requireAdmin() { return requireAdminGuard() }
export async function getTableData(table: string, page = 1, pageSize = 50, search = '') { return pgGetTableData(table, page, pageSize, search) }
export async function upsertTableRow(table: string, rowId: string | null, payload: Record<string, unknown>) { return pgUpsertTableRow(table, rowId, payload) }
export async function deleteTableRow(table: string, rowId: string) { return pgDeleteTableRow(table, rowId) }
export async function exportDatabaseData() { return pgExportDatabaseData() }
export async function importDatabaseData(source: string): Promise<{ success?: boolean; error?: string; tablesRestored?: string[] }> {
  const result = await pgImportDatabaseData(source)
  if (result.success) revalidatePath('/', 'layout')
  return result
}
export async function createAuthUser(payload: { email?: string; password: string; full_name: string; role: 'admin' | 'viewer'; is_active: boolean }) { return pgCreateAuthUser(payload) }
export async function deleteAuthUser(userId: string) { return pgDeleteAuthUser(userId) }
export async function resetAuthPassword(userId: string, newPassword: string) { return pgResetAuthPassword(userId, newPassword) }
export async function updateUserEmail(userId: string, newEmail: string) { return pgUpdateUserEmail(userId, newEmail) }
export async function updateUserProfileRoleAndStatus(userId: string, payload: { role?: 'admin' | 'viewer'; is_active?: boolean; full_name?: string }) { return pgUpdateUserProfile(userId, payload) }
