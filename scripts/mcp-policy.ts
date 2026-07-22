import { z } from 'zod'

const nullableUuid = z.uuid().nullable()
const itemFields = {
  item_name: z.string(), item_type: z.enum(['asset', 'material']), unit_price: z.number(),
  category_id: nullableUuid, quantity: z.number().int().min(1), unit_id: nullableUuid,
  asset_no: z.string().nullable(), serial_no: z.string().nullable(), brand: z.string().nullable(),
  model: z.string().nullable(), location_id: nullableUuid, responsible_person: z.string().nullable(),
  status: z.string(), note: z.string().nullable(),
}

const createItemSchema = z.strictObject({
  item_name: itemFields.item_name,
  item_type: itemFields.item_type,
  quantity: itemFields.quantity,
  unit_price: itemFields.unit_price.optional(), category_id: itemFields.category_id.optional(),
  unit_id: itemFields.unit_id.optional(), asset_no: itemFields.asset_no.optional(),
  serial_no: itemFields.serial_no.optional(), brand: itemFields.brand.optional(),
  model: itemFields.model.optional(), location_id: itemFields.location_id.optional(),
  responsible_person: itemFields.responsible_person.optional(), status: itemFields.status.optional(),
  note: itemFields.note.optional(),
})

const updateFieldsSchema = z.strictObject({
  item_name: itemFields.item_name.optional(), item_type: itemFields.item_type.optional(),
  unit_price: itemFields.unit_price.optional(), category_id: itemFields.category_id.optional(),
  quantity: itemFields.quantity.optional(), unit_id: itemFields.unit_id.optional(),
  asset_no: itemFields.asset_no.optional(), serial_no: itemFields.serial_no.optional(),
  brand: itemFields.brand.optional(), model: itemFields.model.optional(),
  location_id: itemFields.location_id.optional(), responsible_person: itemFields.responsible_person.optional(),
  status: itemFields.status.optional(), note: itemFields.note.optional(),
}).refine((updates) => Object.keys(updates).length > 0, {
  message: 'At least one update field is required',
})

const updateItemSchema = z.strictObject({ id: z.uuid(), updates: updateFieldsSchema })
const deleteItemSchema = z.strictObject({ id: z.uuid() })

export function isMcpWriteEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.CAMMS_MCP_ALLOW_WRITE === 'true' && Boolean(env.SUPABASE_SERVICE_ROLE_KEY)
}

export function parseMcpCreateItem(input: unknown) {
  return createItemSchema.parse(input)
}

export function parseMcpUpdateItem(input: unknown) {
  return updateItemSchema.parse(input)
}

export function parseMcpDeleteItem(input: unknown) {
  return deleteItemSchema.parse(input)
}
