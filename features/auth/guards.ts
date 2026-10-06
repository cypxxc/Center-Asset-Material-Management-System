import { getCurrentProfile } from '@/features/auth/queries'
import { isAdmin, canWrite, canDelete, canManageSettings } from '@/lib/permissions'
import { logger } from '@/lib/logging'

export async function requireAuth() {
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) {
    return { error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ', profile: null }
  }
  return { error: null, profile }
}

export async function requireAdmin() {
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) {
    logger.warn({ operation: 'requireAdmin', feature: 'auth', details: 'Access denied: inactive or unauthenticated' })
    return { error: 'Access Denied: Admin role required and profile must be active', profile: null }
  }
  if (!isAdmin(profile.role)) {
    logger.warn({ operation: 'requireAdmin', feature: 'auth', details: 'Access denied: admin role required' })
    return { error: 'Access Denied: Admin role required and profile must be active', profile: null }
  }
  return { error: null, profile }
}

export async function requireEditor() {
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) {
    return { error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ', profile: null }
  }
  if (!canWrite(profile.role)) {
    return { error: 'คุณไม่มีสิทธิ์แก้ไขข้อมูลสิ่งของ', profile: null }
  }
  return { error: null, profile }
}

export async function requireDeletePermission() {
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) {
    return { error: 'กรุณาเข้าสู่ระบบก่อนทำรายการ', profile: null }
  }
  if (!canDelete(profile.role)) {
    return { error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่มีสิทธิ์ทำรายการนี้', profile: null }
  }
  return { error: null, profile }
}

export async function requireSettingsManager() {
  const profile = await getCurrentProfile()
  if (!profile || !profile.is_active) {
    return { error: 'กรุณาเข้าสู่ระบบก่อนจัดการตั้งค่า', profile: null }
  }
  if (!canManageSettings(profile.role)) {
    return { error: 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการตั้งค่าได้', profile: null }
  }
  return { error: null, profile }
}
