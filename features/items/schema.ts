import { z } from 'zod'

const optionalUuid = z
  .string()
  .trim()
  .uuid('รูปแบบรหัสไม่ถูกต้อง')
  .optional()
  .or(z.literal('').transform(() => undefined))

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.string().url('รูปแบบ URL ไม่ถูกต้อง').nullable())

export const itemTypeSchema = z.enum(['material', 'asset', 'general'])

export const itemStatusSchema = z.enum([
  'active',
  'spare',
  'damaged',
  'waiting_repair',
  'inactive',
  'disposed',
])

export const itemFormSchema = z.object({
  item_name: z.string().trim().min(1, 'กรุณากรอกชื่อสิ่งของ'),
  item_type: itemTypeSchema,
  category_id: optionalUuid,
  quantity: z.coerce.number().int('จำนวนต้องเป็นจำนวนเต็ม').min(1, 'จำนวนต้องมากกว่า 0'),
  unit_id: optionalUuid,
  asset_no: optionalText,
  serial_no: optionalText,
  brand: optionalText,
  model: optionalText,
  location_id: optionalUuid,
  responsible_person: optionalText,
  status: itemStatusSchema,
  note: optionalText,
  image_url: optionalUrl,
})

export type ItemFormInput = z.infer<typeof itemFormSchema>
