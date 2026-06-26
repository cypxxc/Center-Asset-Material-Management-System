'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { categorySchema, locationSchema, unitSchema } from './schema'

type MetadataKind = 'category' | 'location' | 'unit'

const itemReferenceColumn: Record<MetadataKind, 'category_id' | 'location_id' | 'unit_id'> = {
  category: 'category_id',
  location: 'location_id',
  unit: 'unit_id',
}

async function requireAdmin() {
  const profile = await getCurrentProfile()

  if (!profile || !profile.is_active) {
    redirect('/settings?error=Please sign in before managing settings')
  }

  if (profile.role !== 'admin') {
    redirect('/settings?error=Only admins can manage settings')
  }
}

function redirectToSettings(type: 'message' | 'error', text: string): never {
  redirect(`/settings?${type}=${encodeURIComponent(text)}`)
}

function friendlyDatabaseError(message: string) {
  if (message.toLowerCase().includes('duplicate') || message.toLowerCase().includes('unique')) {
    return 'A record with this name already exists'
  }

  return 'Unable to save settings. Please review the data and try again'
}

async function ensureCanDeactivate(kind: MetadataKind, id: string, nextActive: boolean) {
  if (nextActive) return null

  const supabase = await createClient()
  const { count, error } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq(itemReferenceColumn[kind], id)
    .is('deleted_at', null)

  if (error) return 'Unable to verify item usage before changing status'
  if ((count ?? 0) > 0) return 'This record is used by existing items and cannot be deactivated'

  return null
}

function revalidateSettings() {
  revalidatePath('/settings')
  revalidatePath('/items/new')
  revalidatePath('/items')
}

export async function createCategory(formData: FormData) {
  await requireAdmin()
  const parsed = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'Category name is required')

  const supabase = await createClient()
  const { error } = await supabase.from('categories').insert(parsed.data)
  if (error) redirectToSettings('error', friendlyDatabaseError(error.message))

  revalidateSettings()
  redirectToSettings('message', 'Category created')
}

export async function updateCategory(id: string, formData: FormData) {
  await requireAdmin()
  const parsed = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'Category name is required')

  const usageError = await ensureCanDeactivate('category', id, parsed.data.is_active)
  if (usageError) redirectToSettings('error', usageError)

  const supabase = await createClient()
  const { error } = await supabase
    .from('categories')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) redirectToSettings('error', friendlyDatabaseError(error.message))

  revalidateSettings()
  redirectToSettings('message', 'Category updated')
}

export async function createLocation(formData: FormData) {
  await requireAdmin()
  const parsed = locationSchema.safeParse({
    name: formData.get('name'),
    building: formData.get('building'),
    floor: formData.get('floor'),
    room: formData.get('room'),
    department: formData.get('department'),
    description: formData.get('description'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'Location name is required')

  const supabase = await createClient()
  const { error } = await supabase.from('locations').insert(parsed.data)
  if (error) redirectToSettings('error', friendlyDatabaseError(error.message))

  revalidateSettings()
  redirectToSettings('message', 'Location created')
}

export async function updateLocation(id: string, formData: FormData) {
  await requireAdmin()
  const parsed = locationSchema.safeParse({
    name: formData.get('name'),
    building: formData.get('building'),
    floor: formData.get('floor'),
    room: formData.get('room'),
    department: formData.get('department'),
    description: formData.get('description'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'Location name is required')

  const usageError = await ensureCanDeactivate('location', id, parsed.data.is_active)
  if (usageError) redirectToSettings('error', usageError)

  const supabase = await createClient()
  const { error } = await supabase
    .from('locations')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) redirectToSettings('error', friendlyDatabaseError(error.message))

  revalidateSettings()
  redirectToSettings('message', 'Location updated')
}

export async function createUnit(formData: FormData) {
  await requireAdmin()
  const parsed = unitSchema.safeParse({
    name: formData.get('name'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'Unit name is required')

  const supabase = await createClient()
  const { error } = await supabase.from('units').insert(parsed.data)
  if (error) redirectToSettings('error', friendlyDatabaseError(error.message))

  revalidateSettings()
  redirectToSettings('message', 'Unit created')
}

export async function updateUnit(id: string, formData: FormData) {
  await requireAdmin()
  const parsed = unitSchema.safeParse({
    name: formData.get('name'),
    is_active: formData.get('is_active'),
  })

  if (!parsed.success) redirectToSettings('error', 'Unit name is required')

  const usageError = await ensureCanDeactivate('unit', id, parsed.data.is_active)
  if (usageError) redirectToSettings('error', usageError)

  const supabase = await createClient()
  const { error } = await supabase
    .from('units')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) redirectToSettings('error', friendlyDatabaseError(error.message))

  revalidateSettings()
  redirectToSettings('message', 'Unit updated')
}

export async function updateProfile(id: string, formData: FormData) {
  await requireAdmin()
  const currentProfile = await getCurrentProfile()
  if (currentProfile?.id === id) {
    redirectToSettings('error', 'Cannot modify your own profile settings')
  }

  const role = formData.get('role') as string
  const isActiveCheckbox = formData.get('is_active')

  if (role !== 'admin' && role !== 'staff' && role !== 'viewer') {
    redirectToSettings('error', 'Invalid role selection')
  }

  const is_active = isActiveCheckbox === 'on' || isActiveCheckbox === 'true'

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({
      role,
      is_active,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) redirectToSettings('error', error.message)

  revalidateSettings()
  redirectToSettings('message', 'User profile updated')
}
