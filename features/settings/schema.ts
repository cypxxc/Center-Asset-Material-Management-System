import { z } from 'zod'
import { normalizeForStorage, getGraphemeLength } from '@/lib/unicode'

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

export const categorySchema = z.object({
  name: requiredName,
  description: optionalText,
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
