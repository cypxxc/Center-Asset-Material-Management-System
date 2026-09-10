import { z } from 'zod'
import { normalizeForStorage, getGraphemeLength } from '@/lib/unicode'

const ADMIN_TABLES = ['profiles', 'categories', 'locations', 'units', 'items', 'audit_logs'] as const
export type AdminTable = (typeof ADMIN_TABLES)[number]
export type AdminTableOperation = 'read' | 'write' | 'insert' | 'update' | 'delete'
export function assertAdminTable(value: string, operation: AdminTableOperation): AdminTable {
  if (!(ADMIN_TABLES as readonly string[]).includes(value)) throw new Error('Unsupported admin table')
  if (value === 'audit_logs' && operation !== 'read') throw new Error('Audit logs are read-only')
  if (value === 'profiles' && (operation === 'insert' || operation === 'delete')) {
    throw new Error('Use user management to create or delete authentication accounts')
  }
  return value as AdminTable
}

const text = (max: number) => z.string().transform(normalizeForStorage).pipe(z.string().max(max))
const name = (max: number) => z.string().transform(normalizeForStorage)
  .refine(value => getGraphemeLength(value) >= 1, 'Name is required')
  .refine(value => getGraphemeLength(value) <= max, `Name must be ${max} characters or fewer`)
const nullable = <T extends z.ZodType>(schema: T) => z.preprocess(v => v === '' ? null : v, schema.nullable()).optional()
const uuid = nullable(z.string().uuid())
const common = { name: name(120), is_active: z.boolean().optional() }
const item = z.object({
  item_name: name(255), item_type: z.enum(['material', 'asset']),
  category_id: uuid, unit_id: uuid, location_id: uuid,
  quantity: z.number().int().min(1).max(2147483647).optional(),
  unit_price: nullable(z.number().min(0).max(999999999.99)),
  asset_no: nullable(text(150)), serial_no: nullable(text(150)), brand: nullable(text(150)), model: nullable(text(150)),
  responsible_person: nullable(text(150)), note: nullable(text(2000)), image_url: nullable(z.string().url().max(500)),
  status: z.enum(['active', 'spare', 'damaged', 'waiting_repair', 'inactive', 'disposed']).optional(),
  asset_number_source: nullable(z.enum(['manual', 'template', 'automatic', 'import', 'legacy'])),
  asset_number_template_id: uuid, asset_number_payload: nullable(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  depreciation_enabled: z.boolean().optional(), depreciation_method: nullable(z.literal('straight_line')),
  depreciation_cost: nullable(z.number().positive().max(9999999999.99)),
  depreciation_useful_life_years: nullable(z.number().int().positive().max(2147483647)),
  depreciation_start_basis: nullable(z.enum(['acquired', 'available', 'manual'])),
  depreciation_start_date: nullable(z.iso.date()), depreciation_residual_value: z.literal(1).optional(),
}).strict()
const schemas = {
  profiles: z.object({ full_name: name(255), role: z.enum(['admin', 'staff', 'viewer']), is_active: z.boolean(), sidebar_order: z.array(z.string().max(100)).max(100).nullable().optional() }).strict(),
  categories: z.object({ ...common, description: nullable(text(1000)) }).strict(),
  locations: z.object({ ...common, building: nullable(text(1000)), floor: nullable(text(1000)), room: nullable(text(1000)), department: nullable(text(1000)), description: nullable(text(1000)) }).strict(),
  units: z.object(common).strict(),
  items: item,
}

export function parseAdminRowId(value: unknown): string { return z.string().uuid().parse(value) }

// Full rows are sent by the editor. Only database-managed columns are ignored;
// unknown columns are errors, so additions cannot accidentally widen service-role writes.
export function parseAdminMutation(table: AdminTable, operation: 'insert' | 'update', payload: unknown): Record<string, unknown> {
  assertAdminTable(table, operation)
  const input = z.record(z.string(), z.unknown()).parse(payload)
  const metadata = ['id', 'created_at', 'updated_at', 'deleted_at']
  if (table === 'items') metadata.push('created_by', 'updated_by', 'deleted_by')
  if (table === 'profiles') metadata.push('email')
  for (const key of metadata) delete input[key]
  const schema = schemas[table as keyof typeof schemas]
  const data = (operation === 'update' ? schema.partial() : schema).parse(input)
  if (!Object.keys(data).length) throw new Error('No editable fields supplied')
  if (table === 'items' && operation === 'insert') validateAdminItemState(data)
  return data
}

export function validateAdminItemState(data: Record<string, unknown>): void {
  const parsed = item.parse(Object.fromEntries(Object.entries(data).filter(([key]) => key in item.shape)))
  if (parsed.depreciation_enabled && (parsed.item_type !== 'asset' || parsed.depreciation_method !== 'straight_line' ||
      !parsed.depreciation_cost || parsed.depreciation_cost <= 1 || !parsed.depreciation_useful_life_years ||
      !parsed.depreciation_start_basis || !parsed.depreciation_start_date || (parsed.depreciation_residual_value ?? 1) !== 1)) {
    throw new Error('Enabled depreciation requires an asset, straight-line method, cost greater than 1, useful life, start basis and valid start date')
  }
}

export function adminPolicyError(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map(issue => `${issue.path.join('.') || 'payload'}: ${issue.message}`).join('; ')
  return error instanceof Error ? error.message : 'Invalid database operation'
}
