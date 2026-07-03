'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logging'


export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function login(_prevState: { error?: string } | null, formData: FormData) {
  const identifier = ((formData.get('id') as string) || '').trim()
  const password = formData.get('password') as string

  if (!identifier || !password) {
    return { error: 'กรุณากรอกข้อมูลและรหัสผ่าน' }
  }

  const supabase = await createClient()
  const adminClient = await createAdminClient()

  // Determine identifier type: email, uuid, or full_name
  const isEmail = identifier.includes('@')
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  const isUUID = uuidRegex.test(identifier)

  let email: string | null = null

  try {
    if (isEmail) {
      // Use the identifier directly as email
      email = identifier
    } else if (isUUID) {
      // Lookup auth user by id via admin auth API (profiles may not store email)
      const { data: userData, error: userErr } = await adminClient.auth.admin.getUserById(identifier)
      if (userErr) {
        logger.error({ operation: 'login', feature: 'auth', details: 'Login UUID lookup error' }, userErr)
        return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
      }
      if (!userData || !userData.user) return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
      email = userData.user.email ?? null
      if (!email) return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
    } else {
      // Treat as full_name (case-insensitive partial match)
      const { data: profiles, error: profileErr } = await adminClient
        .from('profiles')
        .select('email')
        .ilike('full_name', identifier)
        .limit(1)

      if (profileErr) {
        logger.error({ operation: 'login', feature: 'auth', details: 'Login name lookup error' }, profileErr)
        return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
      }
      if (!profiles || profiles.length === 0) return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
      email = profiles[0].email as string
    }
  } catch (err) {
    logger.error({ operation: 'login', feature: 'auth', details: 'Login exception' }, err)
    return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
  }

  if (!email) return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือเกิดข้อผิดพลาดในการเชื่อมต่อ' }
  }

  redirect('/dashboard')
}

export type PersonalProfileActionState = {
  error?: string
  success?: string
}

export async function updatePersonalProfile(_prevState: PersonalProfileActionState | null, formData: FormData): Promise<PersonalProfileActionState> {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const fullName = formData.get('full_name') as string
  if (!fullName || fullName.trim().length === 0) {
    return { error: 'กรุณากรอกชื่อ-นามสกุล' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    return { error: 'ไม่สามารถอัปเดตข้อมูลส่วนตัวได้: ' + error.message }
  }

  revalidatePath('/', 'layout')
  return { success: 'อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว' }
}

export async function updatePersonalPassword(_prevState: PersonalProfileActionState | null, formData: FormData): Promise<PersonalProfileActionState> {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (!password || password.length < 6) {
    return { error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' }
  }

  if (password !== confirmPassword) {
    return { error: 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน' }
  }

  try {
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      return { error: 'ไม่สามารถเปลี่ยนรหัสผ่านได้: ' + error.message }
    }
  } catch (err) {
    logger.error({ operation: 'updatePersonalPassword', feature: 'auth', details: 'updatePersonalPassword exception' }, err)
    return { error: 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย กรุณาลองใหม่อีกครั้ง' }
  }

  return { success: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' }
}

export async function updateSidebarOrder(order: string[]): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) return { error: 'กรุณาเข้าสู่ระบบ' }

  const { error } = await supabase
    .from('profiles')
    .update({
      sidebar_order: order,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    logger.error({ operation: 'updateSidebarOrder', feature: 'auth', details: 'updateSidebarOrder db update failure: ' + error.message })
    return { error: 'ไม่สามารถบันทึกลำดับเมนูได้' }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}


