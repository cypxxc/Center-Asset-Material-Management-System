export interface AssetNumberTemplate {
  id: string
  name: string
  pattern: string
  field_defaults: Record<string, string>
  is_active: boolean
  created_at: string
  updated_at: string
}
