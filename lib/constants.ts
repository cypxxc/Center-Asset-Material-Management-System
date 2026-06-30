// Shared constants for Office Item Registry System

export const ITEM_TYPES = {
  material: 'วัสดุสิ้นเปลือง',
  asset: 'ครุภัณฑ์',
  general: 'อุปกรณ์ทั่วไป',
} as const;

export type ItemType = keyof typeof ITEM_TYPES;

export const ITEM_STATUSES = {
  active: { label: 'ใช้งานอยู่', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  spare: { label: 'เก็บสำรอง', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  damaged: { label: 'ชำรุด', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  waiting_repair: { label: 'รอซ่อม', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  inactive: { label: 'ไม่ใช้งาน', color: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20' },
  disposed: { label: 'จำหน่าย/ตัดออก', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
} as const;

export type ItemStatus = keyof typeof ITEM_STATUSES;

export const USER_ROLES = {
  admin: 'ผู้ดูแลระบบ (Admin)',
  staff: 'เจ้าหน้าที่ (Staff)',
  viewer: 'ผู้เข้าชม (Viewer)',
} as const;

export type UserRole = keyof typeof USER_ROLES;
