import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export const getCurrentUser = cache(async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
})

export const getCurrentProfile = cache(async function getCurrentProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
})
