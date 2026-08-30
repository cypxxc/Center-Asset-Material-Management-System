import { z } from 'zod'
import { normalizeForStorage, getGraphemeLength } from '@/lib/unicode'
import { stripCommas } from '@/lib/number-format'

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

const optionalUnitPrice = z.preprocess(
  (val) => {
    if (typeof val === 'string') {
      const normalized = stripCommas(normalizeForStorage(val))
      return normalized === '' ? null : normalized
    }
    return val ?? null
  },
  z
    .coerce
    .number('ราคาต่อหน่วยต้องเป็นตัวเลข')
    .min(0, 'ราคาต่อหน่วยต้องไม่ติดลบ')
    .max(999999999.99, 'ราคาต่อหน่วยสูงเกินกำหนด')
    .nullable()
)

const optionalPositiveNumber = z.preprocess(
  (val) => typeof val === 'string' ? (stripCommas(normalizeForStorage(val)) || null) : val ?? null,
  z.coerce.number('กรุณากรอกเป็นตัวเลข').positive('ต้องมากกว่า 0').nullable()
)

const optionalDate = z.preprocess(
  (val) => typeof val === 'string' ? (normalizeForStorage(val) || null) : val ?? null,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ไม่ถูกต้อง').nullable()
)

const itemTypeSchema = z.enum(['material', 'asset'])

const itemStatusSchema = z.enum([
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
  quantity: z.preprocess(
    (val) => typeof val === 'string' ? stripCommas(val) : val,
    z.coerce.number().int('จำนวนต้องเป็นจำนวนเต็ม').min(1, 'จำนวนต้องมากกว่า 0')
  ),
  unit_price: optionalUnitPrice,
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
  depreciation_enabled: z.preprocess((val) => val === true || val === 'true', z.boolean()),
  depreciation_cost: optionalPositiveNumber,
  depreciation_useful_life_years: z.preprocess(
    (val) => typeof val === 'string' ? (stripCommas(val) || null) : val ?? null,
    z.coerce.number().int('อายุใช้งานต้องเป็นจำนวนเต็ม').positive('อายุใช้งานต้องมากกว่า 0').nullable()
  ),
  depreciation_start_basis: z.preprocess(
    (val) => val === '' || val == null ? null : val,
    z.enum(['acquired', 'available', 'manual']).nullable()
  ),
  depreciation_start_date: optionalDate,
}).superRefine((data, ctx) => {
  if (!data.depreciation_enabled) return
  if (data.item_type !== 'asset') ctx.addIssue({ code: 'custom', path: ['depreciation_enabled'], message: 'คิดค่าเสื่อมได้เฉพาะครุภัณฑ์' })
  if (!data.depreciation_cost || data.depreciation_cost <= 1) ctx.addIssue({ code: 'custom', path: ['depreciation_cost'], message: 'มูลค่าพร้อมใช้งานต้องมากกว่า 1 บาท' })
  if (!data.depreciation_useful_life_years) ctx.addIssue({ code: 'custom', path: ['depreciation_useful_life_years'], message: 'กรุณาระบุอายุการใช้งาน' })
  if (!data.depreciation_start_basis) ctx.addIssue({ code: 'custom', path: ['depreciation_start_basis'], message: 'กรุณาเลือกรูปแบบวันเริ่มคิด' })
  if (!data.depreciation_start_date) ctx.addIssue({ code: 'custom', path: ['depreciation_start_date'], message: 'กรุณาระบุวันเริ่มคิดค่าเสื่อม' })
})
