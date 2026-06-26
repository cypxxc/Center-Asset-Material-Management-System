import { z } from 'zod'

const requiredName = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(120, 'Name must be 120 characters or fewer')

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional()
  .transform((value) => value ?? null)

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
