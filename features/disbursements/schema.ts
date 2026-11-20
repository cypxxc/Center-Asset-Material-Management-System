import { z } from 'zod'
import { normalizeForStorage } from '@/lib/unicode'
import { borrowDueDateError } from './borrow-dates'

const stringTrimmed = (max: number, msg: string) =>
  z
    .string()
    .transform(normalizeForStorage)
    .pipe(z.string().trim().min(1, msg).max(max, `ความยาวไม่เกิน ${max} ตัวอักษร`))

const calendarDate = z.iso.date('วันที่ไม่ถูกต้อง กรุณาระบุรูปแบบ YYYY-MM-DD')

export const disbursementDraftSchema = z.object({
  transaction_type: z.enum(['material_issue', 'asset_handover', 'asset_borrow'], {
    message: 'กรุณาเลือกประเภทการทำรายการ',
  }),
  recipient_name: stringTrimmed(150, 'กรุณาระบุชื่อผู้รับวัสดุ'),
  department_name: stringTrimmed(150, 'กรุณาระบุกลุ่มงาน'),
  purpose: stringTrimmed(500, 'กรุณาระบุวัตถุประสงค์'),
  due_date: calendarDate.or(z.literal('')).optional().nullable(),
  items: z
    .array(
      z.object({
        item_id: z.string().uuid('รหัสสิ่งของไม่ถูกต้อง').toLowerCase(),
        requested_qty: z.coerce.number().int().min(1, 'จำนวนต้องมากกว่า 0').max(2147483647),
      })
    )
    .min(1, 'ต้องมีรายการสิ่งของอย่างน้อย 1 รายการ'),
}).superRefine((data, ctx) => {
  if (new Set(data.items.map((item) => item.item_id)).size !== data.items.length) {
    ctx.addIssue({ code: 'custom', path: ['items'], message: 'ไม่สามารถเลือกรายการสิ่งของซ้ำได้' })
  }
  if (data.transaction_type === 'asset_borrow' && !data.due_date) {
    ctx.addIssue({
      code: 'custom',
      path: ['due_date'],
      message: 'กรุณาระบุกำหนดส่งคืนสำหรับรายการยืมสิ่งของ',
    })
  }
  if (data.transaction_type === 'asset_borrow') {
    data.items.forEach((item, index) => {
      if (item.requested_qty !== 1) ctx.addIssue({ code: 'custom', path: ['items', index, 'requested_qty'], message: 'ครุภัณฑ์แต่ละชิ้นต้องมีจำนวนยืมเท่ากับ 1' })
    })
    const dateError = borrowDueDateError(data.due_date)
    if (dateError) ctx.addIssue({ code: 'custom', path: ['due_date'], message: dateError })
  }
})

export const disbursementListParamsSchema = z.object({
  historyOnly: z.boolean().optional().default(false),
  hideCompleted: z.boolean().optional().default(false),
  prioritizePending: z.boolean().optional().default(false),
  q: z.string().optional().default(''),
  request_id: z.string().uuid().optional(),
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
  item_actions: z.record(z.string().uuid(), z.enum(['issue', 'borrow'])).default({}),
  quantities: z.record(z.string().uuid(), z.coerce.number().int().min(1).max(2147483647)).default({}),
  item_ids: z.array(z.string().uuid('รหัสสิ่งของไม่ถูกต้อง').toLowerCase()).min(1, 'ต้องเลือกรายการอย่างน้อย 1 รายการ').max(20),
  request_type: z.enum(['issue', 'borrow']).default('borrow'),
  due_date: calendarDate.optional().nullable(),
  purpose: stringTrimmed(500, 'กรุณาระบุวัตถุประสงค์ในการยืม'),
}).superRefine((data, ctx) => {
  if (Object.keys(data.quantities).some(id => !data.item_ids.includes(id))) {
    ctx.addIssue({ code: 'custom', path: ['quantities'], message: 'จำนวนขอเบิกต้องตรงกับรายการที่เลือก' })
  }
  if (Object.keys(data.item_actions).some(id => !data.item_ids.includes(id))) {
    ctx.addIssue({ code: 'custom', path: ['item_actions'], message: 'การทำรายการต้องตรงกับสิ่งของที่เลือก' })
  }
  if (new Set(data.item_ids).size !== data.item_ids.length) {
    ctx.addIssue({ code: 'custom', path: ['item_ids'], message: 'ไม่สามารถเลือกรายการสิ่งของซ้ำได้' })
  }
  // Partial maps need inventory types before a missing legacy action can be
  // classified: materials always issue. The server checks that final case.
  if ((Object.values(data.item_actions).includes('borrow') || (Object.keys(data.item_actions).length === 0 && data.request_type === 'borrow')) && !data.due_date) {
    ctx.addIssue({ code: 'custom', path: ['due_date'], message: 'กรุณาระบุกำหนดส่งคืน' })
  }
}).transform((data) => ({ ...data, due_date: data.item_ids.some(id => (data.item_actions[id] ?? data.request_type) === 'borrow') ? data.due_date ?? null : null }))

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
    message: 'กรุณาระบุสภาพวัสดุ',
  }),
  note: z.string().transform(normalizeForStorage).pipe(z.string().max(500)).optional().nullable(),
})

export const reverseDisbursementSchema = z.object({
  disbursement_id: z.string().uuid('รหัสเอกสารไม่ถูกต้อง'),
  reason: stringTrimmed(500, 'กรุณาระบุเหตุผลการยกเลิก/คืนสภาพ'),
})

export const partialApproveDisbursementSchema = z.object({
  disbursement_id: z.string().uuid('รหัสเอกสารไม่ถูกต้อง'),
  line_ids: z.array(z.string().uuid('รหัสรายการไม่ถูกต้อง')).min(1, 'ต้องเลือกรายการอย่างน้อย 1 รายการ'),
  replacement_due_date: z.string().optional().nullable(),
})

export const partialRejectDisbursementSchema = z.object({
  disbursement_id: z.string().uuid('รหัสเอกสารไม่ถูกต้อง'),
  line_ids: z.array(z.string().uuid('รหัสรายการไม่ถูกต้อง')).min(1, 'ต้องเลือกรายการอย่างน้อย 1 รายการ'),
  reason: stringTrimmed(500, 'กรุณาระบุเหตุผลการปฏิเสธ'),
})

export const partialReturnDisbursementSchema = z.object({
  disbursement_id: z.string().uuid('รหัสเอกสารไม่ถูกต้อง'),
  items: z.array(
    z.object({
      line_id: z.string().uuid('รหัสรายการไม่ถูกต้อง'),
      item_id: z.string().uuid('รหัสครุภัณฑ์ไม่ถูกต้อง'),
      condition: z.enum(['normal', 'damaged'], {
        message: 'กรุณาระบุสภาพครุภัณฑ์',
      }),
      return_date: z.string().optional(),
      reason: stringTrimmed(500, 'กรุณาระบุเหตุผลในการคืน'),
    })
  ).min(1, 'ต้องเลือกครุภัณฑ์ที่ต้องการคืนอย่างน้อย 1 รายการ'),
})
