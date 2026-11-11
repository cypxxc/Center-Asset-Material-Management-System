import { z } from 'zod'
import { normalizeForStorage } from '@/lib/unicode'

const stringTrimmed = (max: number, msg: string) =>
  z
    .string()
    .transform(normalizeForStorage)
    .pipe(z.string().trim().min(1, msg).max(max, `ความยาวไม่เกิน ${max} ตัวอักษร`))

export const disbursementDraftSchema = z.object({
  transaction_type: z.enum(['material_issue', 'asset_handover', 'asset_borrow'], {
    message: 'กรุณาเลือกประเภทการทำรายการ',
  }),
  recipient_name: stringTrimmed(150, 'กรุณาระบุชื่อผู้รับพัสดุ'),
  department_name: stringTrimmed(150, 'กรุณาระบุกลุ่มงาน'),
  purpose: stringTrimmed(500, 'กรุณาระบุวัตถุประสงค์'),
  due_date: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        item_id: z.string().uuid('รหัสสิ่งของไม่ถูกต้อง'),
        requested_qty: z.coerce.number().int().min(1, 'จำนวนต้องมากกว่า 0'),
      })
    )
    .min(1, 'ต้องมีรายการสิ่งของอย่างน้อย 1 รายการ'),
}).superRefine((data, ctx) => {
  if (data.transaction_type === 'asset_borrow' && !data.due_date) {
    ctx.addIssue({
      code: 'custom',
      path: ['due_date'],
      message: 'กรุณาระบุกำหนดส่งคืนสำหรับรายการยืมครุภัณฑ์',
    })
  }
})

export const disbursementListParamsSchema = z.object({
  q: z.string().optional().default(''),
  status: z
    .enum([
      'draft',
      'pending_approval',
      'confirmed',
      'active_borrow',
      'partially_returned',
      'returned',
      'reversed',
      'cancelled',
      'rejected',
    ])
    .optional(),
  type: z.enum(['material_issue', 'asset_handover', 'asset_borrow']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
})

export const submitBorrowRequestSchema = z.object({
  item_ids: z.array(z.string().uuid('รหัสสิ่งของไม่ถูกต้อง')).min(1, 'ต้องเลือกรายการอย่างน้อย 1 รายการ'),
  due_date: z.string().min(1, 'กรุณาระบุกำหนดส่งคืน'),
  purpose: stringTrimmed(500, 'กรุณาระบุวัตถุประสงค์ในการยืม'),
})

export const rejectDisbursementSchema = z.object({
  disbursement_id: z.string().uuid('รหัสเอกสารไม่ถูกต้อง'),
  reason: z.string().transform(normalizeForStorage).pipe(z.string().max(500)).optional(),
})

export const updateDisbursementDraftSchema = disbursementDraftSchema.extend({
  id: z.string().uuid('รหัสเอกสารไม่ถูกต้อง'),
})

export const cancelDisbursementDraftSchema = z.object({
  id: z.string().uuid('รหัสเอกสารไม่ถูกต้อง'),
})

export const returnItemSchema = z.object({
  line_id: z.string().uuid('รหัสรายการไม่ถูกต้อง'),
  return_qty: z.coerce.number().int().min(1, 'จำนวนต้องมากกว่า 0'),
  condition: z.enum(['normal', 'damaged', 'lost'], {
    message: 'กรุณาระบุสภาพพัสดุ',
  }),
  note: z.string().transform(normalizeForStorage).pipe(z.string().max(500)).optional().nullable(),
})

export const reverseDisbursementSchema = z.object({
  disbursement_id: z.string().uuid('รหัสเอกสารไม่ถูกต้อง'),
  reason: stringTrimmed(500, 'กรุณาระบุเหตุผลการยกเลิก/คืนสภาพ'),
})
