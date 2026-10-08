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
import { resolveUniqueProfileEmail, classifyLoginIdentifier } from './login-identifier'
import { getDevelopmentSeedAccount, setDevelopmentSessionUser } from './dev-auth'
import { isPostgresBackend } from '@/lib/backend'
import { writeAuditLog } from '@/lib/audit'


export async function signOut() {
  if (isPostgresBackend()) return (await import('./postgres-actions')).postgresSignOut()
  const trace = await beginActionTrace({ feature: 'auth', action: 'signOut' })
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
    const { clearDevelopmentSessionUser } = await import('./dev-auth')
    await clearDevelopmentSessionUser()
    trace.complete('success')
    redirect('/login')
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) throw err
    trace.complete('failure')
    throw err
  }
}

export async function login(_prevState: { error?: string } | null, formData: FormData) {
  if (isPostgresBackend()) return (await import('./postgres-actions')).postgresLogin(formData)
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
  
  const identifierType = classifyLoginIdentifier(identifier)

  let email: string | null = null

  try {
    if (identifierType === 'email') {
      email = identifier
    } else {
      // Only create admin client when needed (non-email login)
      const adminClient = await createAdminClient()
      
      if (identifierType === 'uuid') {
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
          const result = await adminClient.from('profiles').select('email').ilike('full_name', identifier).limit(2)
          if (result.error) throw result.error
          return result
        })

        const profiles = profileResult.data
        const profileEmail = resolveUniqueProfileEmail(profiles ?? [])
        if (!profileEmail) {
          metrics.loginFailure()
          trace.complete('failure', { reason: 'profile_not_found' })
          return { error: 'ข้อมูลระบุตัวผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }
        }
        email = profileEmail
      }
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

  const developmentSeedAccount = getDevelopmentSeedAccount(email, password)

  try {
    const signInResult = await retrySupabase(async () => {
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result.error) throw result.error
      return result
    })

    const userId = signInResult.data.user?.id
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', userId)
        .single()

      if (!profile?.is_active) {
        await supabase.auth.signOut()
        metrics.loginFailure()
        trace.complete('failure', { reason: 'inactive_profile' })
        redirect('/login?error=inactive')
      }
    }
  } catch (err) {
    if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || (err as { digest?: string }).digest?.startsWith('NEXT_REDIRECT'))) throw err

    if (developmentSeedAccount) {
      const adminClient = await createAdminClient()
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('id, email, is_active, role, full_name')
        .eq('email', email)
        .maybeSingle()

      if (!profileError && profile?.is_active) {
        await setDevelopmentSessionUser({
          id: profile.id,
          email: profile.email ?? email,
          role: (profile.role as 'admin' | 'staff' | 'viewer') ?? developmentSeedAccount.role,
          full_name: profile.full_name ?? null,
        })

        metrics.loginSuccess()
        trace.complete('success', { fallback: 'development_seed' })
        redirect('/dashboard')
      }
    }

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
  if (isPostgresBackend()) return (await import('./postgres-actions')).postgresUpdateProfile(formData)
  const trace = await beginActionTrace({ feature: 'auth', action: 'updatePersonalProfile' })

  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      trace.complete('failure', { reason: 'unauthenticated' })
      return { error: 'กรุณาเข้าสู่ระบบ' }
    }

    trace.context.userId = user.id

    const displayNameRaw = formData.get('display_name')
    const fullNameRaw = formData.get('full_name')

    const displayName = displayNameRaw !== null ? String(displayNameRaw).trim() : null
    const fullName = fullNameRaw !== null ? String(fullNameRaw).trim() : null

    if (displayName && displayName.length > 200) {
      trace.complete('failure', { reason: 'validation' })
      return { error: 'ชื่อแสดงผลต้องมีความยาวไม่เกิน 200 ตัวอักษร' }
    }

    const updatePayload: Record<string, unknown> = {}
    if (displayNameRaw !== null) {
      updatePayload.display_name = displayName || null
    } else if (fullName) {
      updatePayload.full_name = fullName
    } else {
      trace.complete('failure', { reason: 'validation' })
      return { error: 'กรุณาระบุข้อมูลที่ต้องการแก้ไข' }
    }

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
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
  if (isPostgresBackend()) return (await import('./postgres-actions')).postgresUpdatePassword(formData)
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

    await writeAuditLog({
      operation: 'UPDATE_PASSWORD',
      feature: 'auth',
      userId: user.id,
      targetType: 'profiles',
      targetId: user.id,
      newValues: { note: 'Password updated by user' },
    })

    trace.complete('success')
    return { success: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' }
  } catch (err) {
    const result = await handleActionError(err, 'updatePersonalPassword', 'auth')
    return { error: result.error ?? result.message }
  }
}

export async function updateSidebarOrder(order: string[]): Promise<{ success?: boolean; error?: string }> {
  if (isPostgresBackend()) return (await import('./postgres-actions')).postgresUpdateSidebar(order)
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
      .update({ sidebar_order: order })
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
