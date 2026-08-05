import { cache } from 'react'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { measureQuery } from '@/lib/performance'
import { getDevelopmentSessionUser } from './dev-auth'

export const getCurrentUser = cache(async function getCurrentUser() {
  const devSessionUser = await getDevelopmentSessionUser()
  if (devSessionUser) {
    return {
      id: devSessionUser.id,
      email: devSessionUser.email,
      user_metadata: { full_name: devSessionUser.full_name ?? null },
    }
  }

  const supabase = await createClient()
  const {
    result: {
      data: { user },
      error,
    },
  } = await measureQuery('auth.getCurrentUser', () => supabase.auth.getUser())
  if (error || !user) return null
  return user
})

export const getCurrentProfile = cache(async function getCurrentProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const devSessionUser = await getDevelopmentSessionUser()
  if (devSessionUser) {
    const adminClient = await createAdminClient()
    const {
      data: profile,
    } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', devSessionUser.id)
      .maybeSingle()

    return profile
  }

  const supabase = await createClient()
  const {
    result: { data: profile },
  } = await measureQuery('auth.getCurrentProfile', () =>
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
  )

  return profile
})
