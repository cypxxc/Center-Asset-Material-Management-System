import { z } from 'zod'

const nullableNumber = (integer = false) => z.preprocess(value => {
  if (value === '' || value === null || value === undefined) return null
  return typeof value === 'string' ? Number(value.replaceAll(',', '').trim()) : value
}, (integer ? z.number().int().max(2147483647) : z.number().max(999999999999.99)).nonnegative().nullable())
const nullableText = z.preprocess(value => value === '' || value === undefined ? null : value, z.string().max(2000).nullable())
export const materialLedgerSchema = z.object({
  specification: nullableText, commodity_code: nullableText,
  minimum_quantity: nullableNumber(true), maximum_quantity: nullableNumber(true),
  fiscal_year: z.preprocess(value => value === '' || value == null ? null : Number(value), z.number().int().min(2400).max(9999).nullable()),
  balance_as_of: z.preprocess(value => value === '' || value === undefined ? null : value,
    z.iso.date().nullable()),
  opening_quantity: nullableNumber(true), opening_amount: nullableNumber(),
  received_quantity: nullableNumber(true), received_amount: nullableNumber(),
  issued_quantity: nullableNumber(true), issued_amount: nullableNumber(), balance_amount: nullableNumber(),
})
export type MaterialLedgerData = z.infer<typeof materialLedgerSchema>
export const MATERIAL_LEDGER_FIELDS = Object.keys(materialLedgerSchema.shape) as Array<keyof MaterialLedgerData>
