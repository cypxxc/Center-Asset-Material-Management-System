import { z } from 'zod'

export const ASSET_REGISTER_LABELS = {
  register_sequence: 'ลำดับในทะเบียน',
  asset_prefix: 'ส่วนต้นเลขครุภัณฑ์ / หน่วยงาน',
  register_accumulated_depreciation: 'ค่าเสื่อมราคาสะสมตามทะเบียน',
  register_book_value: 'มูลค่าตามบัญชีตามทะเบียน',
  register_as_of: 'วันที่อ้างอิงยอดบัญชี',
} as const
export const ASSET_REGISTER_FIELDS = Object.keys(ASSET_REGISTER_LABELS) as Array<keyof typeof ASSET_REGISTER_LABELS>

const blankToNull = (value: unknown) => typeof value === 'string' ? value.trim() || null : value ?? null
const text = z.preprocess(blankToNull, z.string().max(150).nullable())
const amount = (signed = false) => z.preprocess(value => {
  const normalized = blankToNull(value)
  return typeof normalized === 'string' ? Number(normalized.replaceAll(',', '')) : normalized
}, z.number().finite().min(signed ? -999999999999.99 : 0).max(999999999999.99).nullable())

export const assetRegisterSchema = z.object({
  register_sequence: text,
  asset_prefix: text,
  register_accumulated_depreciation: amount(true),
  register_book_value: amount(),
  register_as_of: z.preprocess(blankToNull, z.iso.date().nullable()),
})
export type AssetRegisterData = z.infer<typeof assetRegisterSchema>
