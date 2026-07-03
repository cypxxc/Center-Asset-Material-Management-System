import { z } from 'zod'
import { normalizeForStorage, getGraphemeLength } from '@/lib/unicode'

const optionalUuid = z.preprocess(
  (val) => typeof val === 'string' ? normalizeForStorage(val) : val,
  z
    .string()
    .uuid('รูปแบบรหัสไม่ถูกต้อง')
    .optional()
    .or(z.literal('').transform(() => undefined))
)

const optionalUrl = z.preprocess(
  (val) => typeof val === 'string' ? normalizeForStorage(val) : val,
  z
    .string()
    .url('รูปแบบ URL ไม่ถูกต้อง')
    .max(500, 'URL ต้องมีความยาวไม่เกิน 500 ตัวอักษร')
    .optional()
    .or(z.literal('').transform(() => undefined))
    .transform((value) => value || null)
)

const optionalTextLimit = (maxLen: number) => z.preprocess(
  (val) => typeof val === 'string' ? normalizeForStorage(val) : val,
  z
    .string()
    .max(maxLen, `ความยาวต้องไม่เกิน ${maxLen} ตัวอักษร`)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null))
)

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
  item_name: z.preprocess(
    (val) => typeof val === 'string' ? normalizeForStorage(val) : val,
    z
      .string()
      .refine((val) => getGraphemeLength(val) >= 1, 'กรุณากรอกชื่อสิ่งของ')
      .refine((val) => getGraphemeLength(val) <= 255, 'ชื่อสิ่งของต้องยาวไม่เกิน 255 ตัวอักษร')
  ),
  item_type: itemTypeSchema,
  category_id: optionalUuid,
  quantity: z.coerce.number().int('จำนวนต้องเป็นจำนวนเต็ม').min(1, 'จำนวนต้องมากกว่า 0'),
  unit_id: optionalUuid,
  asset_no: optionalTextLimit(150),
  serial_no: optionalTextLimit(150),
  brand: optionalTextLimit(150),
  model: optionalTextLimit(150),
  location_id: optionalUuid,
  responsible_person: optionalTextLimit(150),
  status: itemStatusSchema,
  note: optionalTextLimit(2000),
  image_url: optionalUrl,
})

export type ItemFormInput = z.infer<typeof itemFormSchema>
