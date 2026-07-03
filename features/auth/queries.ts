import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { measureQuery } from '@/lib/performance'

export const getCurrentUser = cache(async function getCurrentUser() {
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
