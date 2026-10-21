import { z } from 'zod'
import { normalizeForStorage, getGraphemeLength } from '@/lib/unicode'
import { CATEGORY_ICON_MAP } from '@/lib/category-icons'

const requiredName = z.preprocess(
  (val) => typeof val === 'string' ? normalizeForStorage(val) : val,
  z
    .string()
    .refine((val) => getGraphemeLength(val) >= 1, 'กรุณากรอกชื่อ')
    .refine((val) => getGraphemeLength(val) <= 120, 'ชื่อต้องมีความยาวไม่เกิน 120 ตัวอักษร')
)

const optionalText = z.preprocess(
  (val) => typeof val === 'string' ? normalizeForStorage(val) : val,
  z
    .string()
    .refine((val) => getGraphemeLength(val) <= 1000, 'ความยาวต้องไม่เกิน 1,000 ตัวอักษร')
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null))
)

const checkboxBoolean = z
  .unknown()
  .transform((value) => value === 'on' || value === 'true' || value === true)

const hex6ColorRegex = /^#[0-9A-Fa-f]{6}$/

export const categorySchema = z.object({
  name: requiredName,
  description: optionalText,
  color: z.preprocess(
    (val) => {
      if (val == null || (typeof val === 'string' && val.trim() === '')) {
        return undefined
      }
      if (typeof val === 'string') {
        return val.trim().toUpperCase()
      }
      return val
    },
    z
      .string()
      .regex(hex6ColorRegex, 'รหัสสีไม่ถูกต้อง (ต้องอยู่ในรูปแบบ HEX 6 หลัก เช่น #3B82F6)')
      .default('#64748B')
  ),
  icon: z.preprocess(
    (val) => {
      if (val == null || (typeof val === 'string' && val.trim() === '')) {
        return 'Tag'
      }
      return typeof val === 'string' ? val.trim() : val
    },
    z
      .string()
      .refine((val) => Object.hasOwn(CATEGORY_ICON_MAP, val), 'ไอคอนหมวดหมู่ไม่ถูกต้อง')
      .default('Tag')
  ),
  is_active: checkboxBoolean,
})

export const locationSchema = z.object({
  name: requiredName,
  building: optionalText,
  floor: optionalText,
  room: optionalText,
  department: optionalText,
  description: optionalText,
  is_active: checkboxBoolean,
})

export const unitSchema = z.object({
  name: requiredName,
  is_active: checkboxBoolean,
})
