import { z } from 'zod'

const quantity = z.coerce.number().int().min(0).max(2147483647)
const evidence = z.string().trim().min(1, 'กรุณาระบุเหตุผลและเอกสารอ้างอิง').max(500)
export const stockCommandSchema = z.object({
  item_id: z.string().uuid().toLowerCase(), request_key: z.string().uuid().toLowerCase(),
  kind: z.enum(['receipt', 'count', 'opening']), quantity: quantity.default(0),
  reason: evidence, reference: evidence,
  expected_stock_version: z.coerce.number().int().positive().safe().optional(),
}).superRefine((data, ctx) => {
  if (data.kind === 'receipt' && data.quantity < 1) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'จำนวนรับเข้าต้องตั้งแต่ 1 หน่วย' })
  if (data.kind === 'count' && data.expected_stock_version === undefined) ctx.addIssue({ code: 'custom', path: ['expected_stock_version'], message: 'กรุณาโหลดผลตรวจนับล่าสุด' })
})
export const materialReturnSchema = z.object({
  line_id: z.string().uuid().toLowerCase(), request_key: z.string().uuid().toLowerCase(),
  quantity: quantity.min(1), accepted_quantity: quantity,
  reason: evidence, reference: evidence,
}).refine(data => data.accepted_quantity <= data.quantity, { message: 'จำนวนตรวจรับพร้อมใช้ต้องไม่เกินจำนวนส่งคืน', path: ['accepted_quantity'] })

export function stockDelta(kind: 'receipt' | 'count', current: number, quantity: number) {
  const delta = kind === 'receipt' ? quantity : quantity - current
  if (!Number.isSafeInteger(current + delta) || current + delta < 0 || current + delta > 2147483647) throw new Error('ยอดคงเหลือเกินขอบเขตที่ระบบรองรับ')
  return delta
}

export function returnQuantities(issued: number, alreadyReturned: number, quantity: number, accepted: number) {
  if (![issued, alreadyReturned, quantity, accepted].every(Number.isSafeInteger) || quantity < 1 || accepted < 0 || accepted > quantity || alreadyReturned < 0 || alreadyReturned + quantity > issued) {
    throw new Error('จำนวนรับคืนสะสมต้องไม่เกินจำนวนจ่าย และจำนวนพร้อมใช้ต้องไม่เกินจำนวนส่งคืน')
  }
  return { returned: alreadyReturned + quantity, restock: accepted }
}

export function reconciliation(current: number, opening: number, movements: number) {
  const expected = opening + movements
  return { expected, difference: current - expected, balanced: current === expected }
}

export function metadataUpdateColumns<T extends string>(columns: readonly T[], itemType: string): T[] {
  return columns.filter(column => !(itemType === 'material' && column === 'quantity'))
}
