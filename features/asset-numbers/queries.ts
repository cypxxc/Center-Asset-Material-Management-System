import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { AssetNumberTemplate } from './types'

function normalizeTemplate(row: Omit<AssetNumberTemplate, 'field_defaults'> & { field_defaults: unknown }): AssetNumberTemplate {
  return {
    ...row,
    field_defaults: row.field_defaults && typeof row.field_defaults === 'object'
      ? Object.fromEntries(Object.entries(row.field_defaults as Record<string, unknown>).map(([key, value]) => [key, String(value)]))
      : {},
  }
}

export async function getAssetNumberTemplates(activeOnly = false): Promise<AssetNumberTemplate[]> {
  const supabase = await createClient()
  let query = supabase
    .from('asset_number_templates')
    .select('id, name, pattern, field_defaults, is_active, created_at, updated_at')
    .order('name')

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) return []
  return (data ?? []).map((row) => normalizeTemplate(row as Omit<AssetNumberTemplate, 'field_defaults'> & { field_defaults: unknown }))
}
