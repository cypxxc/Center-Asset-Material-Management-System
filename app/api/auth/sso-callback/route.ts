import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifySsoJwt } from '@/lib/sso/jwt'

export const runtime = 'nodejs'

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin credentials are missing in server environment')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function sanitizeRedirectUrl(redirectTo: string | null): string {
  if (!redirectTo) return '/dashboard'
  // Prevent open redirects; only allow relative paths starting with /
  if (redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
    return redirectTo
  }
  return '/dashboard'
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get('token')
    const redirectToParam = searchParams.get('redirect_to')
    const targetPath = sanitizeRedirectUrl(redirectToParam)

    if (!token) {
      return NextResponse.redirect(new URL('/login?error=missing_token', request.url))
    }

    // 1. Verify Token
    const verification = verifySsoJwt(token)
    if (!verification.valid || !verification.payload) {
      console.error('[SSO Error]:', verification.error)
      const errorCode = encodeURIComponent(verification.error || 'invalid_token')
      return NextResponse.redirect(new URL(`/login?error=${errorCode}`, request.url))
    }

    const { email, full_name, role, department, photo_url, sub: rmuUid } = verification.payload
    const supabaseAdmin = getAdminClient()
    const normalizedEmail = email.trim().toLowerCase()

    // 2. Look up the mirrored profile directly. Auth listUsers is paginated and
    // must not be used as an email lookup during sign-in.
    let supabaseUserId: string
    const { data: existingProfile, error: profileLookupError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (profileLookupError) {
      throw new Error(`Failed to query profile: ${profileLookupError.message}`)
    }

    if (existingProfile) {
      supabaseUserId = existingProfile.id
      await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
        user_metadata: { full_name, role, rmu_uid: rmuUid, department, avatar_url: photo_url },
      })
    } else {
      // Auto-provision user in auth.users
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { full_name, role, rmu_uid: rmuUid, department, avatar_url: photo_url },
      })

      if (createError || !newUser.user) {
        if (createError?.message.toLowerCase().includes('already')) {
          throw new Error('พบบัญชีผู้ใช้เดิมแต่ไม่มีข้อมูลโปรไฟล์ กรุณาให้ผู้ดูแลระบบกู้คืนโปรไฟล์ก่อนเข้าสู่ระบบ')
        }
        throw new Error(createError?.message || 'Failed to auto-create user in Supabase')
      }
      supabaseUserId = newUser.user.id
    }

    // 3. Upsert into public.profiles
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: supabaseUserId,
        email: normalizedEmail,
        full_name: full_name || email.split('@')[0],
        role: role || 'staff',
        department: department || null,
        avatar_url: photo_url || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      console.warn('[SSO Profile Upsert Warning]:', profileError.message)
    }

    // 4. Generate Magic Link session redirect
    const targetUrl = new URL(targetPath, request.url).toString()
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: {
        redirectTo: targetUrl,
      },
    })

    if (linkError || !linkData.properties?.action_link) {
      throw new Error(linkError?.message || 'Failed to generate session link')
    }

    return NextResponse.redirect(linkData.properties.action_link)
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'sso_failed'
    console.error('[SSO Callback Fatal Error]:', error)
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMsg)}`, request.url)
    )
  }
}
