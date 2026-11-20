import { z } from 'zod'

export const custodyHistoryParamsSchema = z.object({
  page: z.number().int().min(1).max(1_000_000).default(1),
  q: z.string().trim().max(500).default(''),
  active_only: z.boolean().default(true),
})

export const assignCustodySchema = z.object({
  item_ids: z.array(z.string().uuid()).min(1, 'กรุณาเลือกสิ่งของ').max(20, 'เลือกได้ครั้งละไม่เกิน 20 รายการ')
    .refine((ids) => new Set(ids).size === ids.length, 'รายการสิ่งของซ้ำกัน'),
  recipient_id: z.string().uuid('กรุณาเลือกผู้ถือครอง'),
  quantities: z.record(z.string().uuid(), z.number().int().min(1).max(2147483647)).default({}),
}).refine(data => Object.keys(data.quantities).every(id => data.item_ids.includes(id)), 'จำนวนต้องตรงกับสิ่งของที่เลือก')

export const returnCustodySchema = z.object({
  item_id: z.string().uuid('กรุณาระบุครุภัณฑ์'),
  return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ไม่ถูกต้อง').optional(),
  condition: z.enum(['normal', 'damaged']),
  reason: z.string().trim().min(1, 'กรุณาระบุเหตุผลในการคืน').max(500),
  location_id: z.string().uuid().or(z.literal('')).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
})

export type ReturnCustodyInput = z.infer<typeof returnCustodySchema>

