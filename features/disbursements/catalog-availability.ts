import { normalizeItemStatus } from '@/features/items/status'

export function centralItemUnavailableReason(item: { quantity: number; status: string | null; reserved: boolean }): string | null {
  if (item.quantity <= 0) return 'ไม่มีจำนวนคงเหลือ'
  const status = item.status ? normalizeItemStatus(item.status) : 'active'
  if (status === 'damaged') return 'ชำรุด'
  if (status === 'inactive') return 'เสื่อมสภาพ'
  if (status !== 'active') return 'ไม่พร้อมเบิก/ยืม'
  if (item.reserved) return 'รออนุมัติ / กำลังยืม'
  return null
}
