import { z } from 'zod'
import { ITEM_STATUS_LABELS } from './types'

export const BULK_EDIT_LIMIT = 1000
export const bulkUpdatesSchema = z.object({
  location_id: z.string().uuid().optional(),
  category_id: z.string().uuid().optional(),
  unit_id: z.string().uuid().optional(),
  responsible_person: z.string().trim().max(200).optional(),
  status: z.enum(Object.keys(ITEM_STATUS_LABELS) as [keyof typeof ITEM_STATUS_LABELS, ...Array<keyof typeof ITEM_STATUS_LABELS>]).optional(),
}).strict().refine(value => Object.values(value).some(v => v !== undefined), 'กรุณาเลือกอย่างน้อยหนึ่งช่องที่ต้องการแก้ไข')
export type BulkItemUpdates = z.infer<typeof bulkUpdatesSchema>
export const bulkEditSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(BULK_EDIT_LIMIT).transform(ids => [...new Set(ids)]),
  updates: bulkUpdatesSchema,
}).strict()
