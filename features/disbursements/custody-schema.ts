import { z } from 'zod'

export const custodyHistoryParamsSchema = z.object({
  page: z.number().int().min(1).max(1_000_000).default(1),
  q: z.string().trim().max(500).default(''),
})

export const assignCustodySchema = z.object({
  item_ids: z.array(z.string().uuid()).min(1, 'กรุณาเลือกสิ่งของ').max(20, 'เลือกได้ครั้งละไม่เกิน 20 รายการ')
    .refine((ids) => new Set(ids).size === ids.length, 'รายการสิ่งของซ้ำกัน'),
  recipient_id: z.string().uuid('กรุณาเลือกผู้ถือครอง'),
  quantities: z.record(z.string().uuid(), z.number().int().min(1).max(2147483647)).default({}),
}).refine(data => Object.keys(data.quantities).every(id => data.item_ids.includes(id)), 'จำนวนต้องตรงกับสิ่งของที่เลือก')
