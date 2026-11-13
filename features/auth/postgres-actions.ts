import 'server-only'
import { sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getPostgresProfile, authenticatePassword, setSessionCookie, replaceCurrentPassword, deleteSession, addCurrentAccountEmail } from '@/lib/postgres/session'
import { withUserDatabase } from '@/lib/postgres/request'
import { checkRateLimit } from '@/lib/rate-limit'
import { consumeLoginAttempt, pruneLoginAttempts } from '@/lib/postgres/login-throttle'
import { isInternalEmail } from '@/lib/display-email'
import { parsePersonalEmail } from './personal-email'

export async function postgresAddPersonalEmail(formData: FormData) {
  const profile = await getPostgresProfile()
  if (!profile?.is_active) return { error: 'กรุณาเข้าสู่ระบบ' }
  if (profile.email && !isInternalEmail(profile.email)) return { error: 'บัญชีนี้มีอีเมลแล้ว' }
  const email = parsePersonalEmail(formData.get('email'))
  if (!email) return { error: 'กรุณาระบุอีเมลให้ถูกต้อง' }
  try {
    if (!await addCurrentAccountEmail(email, profile.email)) return { error: 'ข้อมูลบัญชีเปลี่ยนแปลงแล้ว กรุณาโหลดหน้าใหม่' }
  } catch (error) {
    const cause = error as { code?: string; cause?: { code?: string } }
    if (cause.code === '23505' || cause.cause?.code === '23505') return { error: 'อีเมลนี้ถูกใช้งานแล้ว' }
    return { error: 'ไม่สามารถบันทึกอีเมลได้ กรุณาลองใหม่' }
  }
  revalidatePath('/', 'layout')
  return { success: 'เพิ่มอีเมลเรียบร้อยแล้ว สามารถใช้อีเมลนี้เข้าสู่ระบบได้' }
}

export async function postgresLogin(formData: FormData) {
  const limit = await checkRateLimit('login', 10, 60000, 'anonymous')
  if (!limit.success) return { error: limit.error }
  const identifier = String(formData.get('id') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const error = 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
  if (!identifier || identifier.length > 320 || !password || password.length > 1024) return { error }
  if (!await consumeLoginAttempt(identifier)) return { error: 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอ 1 นาทีแล้วลองใหม่' }
  after(() => pruneLoginAttempts().catch(() => { /* best-effort cleanup */ }))
  const session = await authenticatePassword(identifier, password)
  if (!session) return { error }
  await setSessionCookie(session)
  redirect('/dashboard')
}
export async function postgresSignOut() { await deleteSession(); redirect('/login') }
export async function postgresUpdatePassword(formData: FormData) {
  const profile = await getPostgresProfile()
  if (!profile) return { error: 'กรุณาเข้าสู่ระบบ' }
  const password = String(formData.get('password') ?? '')
  if (password.length < 6 || password.length > 1024) return { error: 'รหัสผ่านใหม่ต้องมีความยาว 6–1024 ตัวอักษร' }
  if (password !== formData.get('confirm_password')) return { error: 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน' }
  if (!await replaceCurrentPassword(password)) return { error: 'กรุณาเข้าสู่ระบบ' }
  return { success: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' }
}
export async function postgresUpdateSidebar(order: string[]) {
  if (!Array.isArray(order) || order.length > 30 || order.some((entry) => typeof entry !== 'string' || entry.length > 100)) return { error: 'ลำดับเมนูไม่ถูกต้อง' }
  const profile = await getPostgresProfile()
  if (!profile) return { error: 'กรุณาเข้าสู่ระบบ' }
  await withUserDatabase((tx) => tx.execute(sql`update public.profiles set sidebar_order=${JSON.stringify(order)}::jsonb where id=${profile.id}`))
  revalidatePath('/', 'layout')
  return { success: true }
}
