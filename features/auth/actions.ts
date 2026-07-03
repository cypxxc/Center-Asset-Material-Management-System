'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { beginActionTrace, classifyActionResponse } from '@/lib/tracing'
import { metrics } from '@/lib/metrics'
import { checkRateLimit } from '@/lib/rate-limit'
import { config } from '@/lib/config'
import { retrySupabase } from '@/lib/retry'
import { handleActionError } from '@/lib/error-handler'
import { AuthorizationError } from '@/lib/errors'


export async function signOut() {
  const trace = await beginActionTrace({ feature: 'auth', action: 'signOut' })
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
    trace.complete('success')
    redirect('/login')
  } catch (err) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    trace.complete('failure')
    throw err
  }
}

export async function login(_prevState: { error?: string } | null, formData: FormData) {
  const trace = await beginActionTrace({ feature: 'auth', action: 'login' })

  const identifier = ((formData.get('id') as string) || '').trim()
  const password = formData.get('password') as string

  if (!identifier || !password) {
    metrics.loginFailure()
    trace.complete('failure', { reason: 'missing_credentials' })
    return { error: 'กรุณากรอกข้อมูลและรหัสผ่าน' }
  }

  const rateLimitCheck = await checkRateLimit(
    'login',
    config.limits.loginRateLimit,
    config.limits.loginRateLimitWindowMs,
  )
  if (!rateLimitCheck.success) {
    metrics.loginFailure()
    trace.complete('failure', { reason: 'rate_limited' })
    return { error: rateLimitCheck.error! }
  }

  const supabase = await createClient()
  const adminClient = await createAdminClient()

  const isEmail = identifier.includes('@')
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  const isUUID = uuidRegex.test(identifier)

  let email: string | null = null

  try {
    if (isEmail) {
      email = identifier
    } else if (isUUID) {
      const userResult = await retrySupabase(async () => {
        const result = await adminClient.auth.admin.getUserById(identifier)
        if (result.error) throw result.error
        return result
      })
      if (!userResult.data?.user) {
        metrics.loginFailure()
        trace.complete('failure', { reason: 'user_not_found' })
        return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
      }
      email = userResult.data.user.email ?? null
      if (!email) {
        metrics.loginFailure()
        trace.complete('failure', { reason: 'no_email' })
        return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
      }
    } else {
      const profileResult = await retrySupabase(async () => {
        const result = await adminClient.from('profiles').select('email').ilike('full_name', identifier).limit(1)
        if (result.error) throw result.error
        return result
      })

      const profiles = profileResult.data
      if (!profiles?.length) {
        metrics.loginFailure()
        trace.complete('failure', { reason: 'profile_not_found' })
        return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
      }
      email = profiles[0].email as string
    }
  } catch (err) {
    trace.complete('failure', { reason: 'exception' })
    const result = await handleActionError(err, 'login', 'auth')
    return { error: result.error ?? result.message }
  }

  if (!email) {
    metrics.loginFailure()
    trace.complete('failure', { reason: 'no_email' })
    return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
  }

  try {
    await retrySupabase(async () => {
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result.error) throw result.error
      return result
    })
  } catch {
    metrics.loginFailure()
    trace.complete('failure', { reason: 'invalid_credentials' })
    return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือเกิดข้อผิดพลาดในการเชื่อมต่อ' }
  }

  metrics.loginSuccess()
  trace.complete('success')
  redirect('/dashboard')
}

export type PersonalProfileActionState = {
  error?: string
  success?: string
}

export async function updatePersonalProfile(_prevState: PersonalProfileActionState | null, formData: FormData): Promise<PersonalProfileActionState> {
  const trace = await beginActionTrace({ feature: 'auth', action: 'updatePersonalProfile' })

  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      trace.complete('failure', { reason: 'unauthenticated' })
      return { error: 'กรุณาเข้าสู่ระบบ' }
    }

    trace.context.userId = user.id

    const fullName = formData.get('full_name') as string
    if (!fullName?.trim()) {
      trace.complete('failure', { reason: 'validation' })
      return { error: 'กรุณากรอกชื่อ-นามสกุล' }
    }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) {
      trace.complete('failure', { reason: 'db_error' })
      return { error: 'ไม่สามารถอัปเดตข้อมูลส่วนตัวได้: ' + error.message }
    }

    revalidatePath('/', 'layout')
    trace.complete('success')
    return { success: 'อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว' }
  } catch (err) {
    const result = await handleActionError(err, 'updatePersonalProfile', 'auth')
    return { error: result.error ?? result.message }
  }
}

export async function updatePersonalPassword(_prevState: PersonalProfileActionState | null, formData: FormData): Promise<PersonalProfileActionState> {
  const trace = await beginActionTrace({ feature: 'auth', action: 'updatePersonalPassword' })

  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      trace.complete('failure', { reason: 'unauthenticated' })
      return { error: 'กรุณาเข้าสู่ระบบ' }
    }

    trace.context.userId = user.id

    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirm_password') as string

    if (!password || password.length < 6) {
      trace.complete('failure', { reason: 'validation' })
      return { error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' }
    }

    if (password !== confirmPassword) {
      trace.complete('failure', { reason: 'validation' })
      return { error: 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน' }
    }

    try {
      await retrySupabase(async () => {
        const result = await supabase.auth.updateUser({ password })
        if (result.error) throw result.error
        return result
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'auth_error'
      trace.complete('failure', { reason: 'auth_error' })
      return { error: 'ไม่สามารถเปลี่ยนรหัสผ่านได้: ' + message }
    }

    trace.complete('success')
    return { success: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' }
  } catch (err) {
    const result = await handleActionError(err, 'updatePersonalPassword', 'auth')
    return { error: result.error ?? result.message }
  }
}

export async function updateSidebarOrder(order: string[]): Promise<{ success?: boolean; error?: string }> {
  const trace = await beginActionTrace({ feature: 'auth', action: 'updateSidebarOrder' })

  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      throw new AuthorizationError('กรุณาเข้าสู่ระบบ')
    }

    trace.context.userId = user.id

    const { error } = await supabase
      .from('profiles')
      .update({ sidebar_order: order, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) {
      trace.complete('failure', { reason: 'db_error' })
      return { error: 'ไม่สามารถบันทึกลำดับเมนูได้' }
    }

    revalidatePath('/', 'layout')
    trace.complete('success')
    return { success: true }
  } catch (err) {
    const result = await handleActionError(err, 'updateSidebarOrder', 'auth')
    trace.complete(classifyActionResponse(result))
    return result
  }
}
