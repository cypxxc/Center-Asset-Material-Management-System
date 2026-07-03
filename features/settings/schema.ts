import { z } from 'zod'
import { normalizeForStorage, getGraphemeLength } from '@/lib/unicode'

const requiredName = z.preprocess(
  (val) => typeof val === 'string' ? normalizeForStorage(val) : val,
  z
    .string()
    .refine((val) => getGraphemeLength(val) >= 1, 'Name is required')
    .refine((val) => getGraphemeLength(val) <= 120, 'Name must be 120 characters or fewer')
)

const optionalText = z.preprocess(
  (val) => typeof val === 'string' ? normalizeForStorage(val) : val,
  z
    .string()
    .max(1000, 'ความยาวต้องไม่เกิน 1,000 ตัวอักษร')
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

export type CategoryInput = z.infer<typeof categorySchema>
export type LocationInput = z.infer<typeof locationSchema>
export type UnitInput = z.infer<typeof unitSchema>
