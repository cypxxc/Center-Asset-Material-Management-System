'use client'
import { useRouter } from 'next/navigation'
import { History } from 'lucide-react'
import { FilterDropdown, type FilterOption } from '@/components/ui/filter-dropdown'
const ACTION_DROPDOWN_OPTIONS: FilterOption[] = [
 { value: 'approval_history', label: 'ประวัติการอนุมัติ', colorDot: 'bg-violet-500' },
 { value: 'custody_history', label: 'การจ่าย', colorDot: 'bg-sky-500' },
 { value: 'INSERT', label: 'สร้างข้อมูล (INSERT)', colorDot: 'bg-emerald-500' },
 { value: 'UPDATE', label: 'แก้ไขข้อมูล (UPDATE)', colorDot: 'bg-blue-500' },
 { value: 'DELETE', label: 'ลบข้อมูล (DELETE)', colorDot: 'bg-rose-500' },
 { value: 'EXPORT_REPORT', label: 'ส่งออกรายงาน (EXPORT)', colorDot: 'bg-purple-500' },
 { value: 'create_user', label: 'สร้างผู้ใช้', colorDot: 'bg-emerald-500' },
 { value: 'update_user', label: 'แก้ไขผู้ใช้', colorDot: 'bg-blue-500' },
 { value: 'delete_user', label: 'ลบผู้ใช้', colorDot: 'bg-rose-500' },
 { value: 'sql_query', label: 'เรียกใช้ SQL', colorDot: 'bg-amber-500' },
 { value: 'backup_restore', label: 'กู้คืนฐานข้อมูล', colorDot: 'bg-indigo-500' },
 { value: 'restore', label: 'กู้คืนวัสดุ', colorDot: 'bg-teal-500' },
 { value: 'bulk_delete', label: 'ลบหลายรายการ', colorDot: 'bg-rose-600' },
]

export function AuditActionFilter({ value, onChange }: { value: string; onChange?: (value: string) => void }) {
 const router = useRouter()
 return <FilterDropdown label="การทำรายการ" ariaLabel="กรองตามการทำรายการ" name="action"
 value={value === 'all' ? '' : value} options={ACTION_DROPDOWN_OPTIONS}
 onChange={(next) => {
 if (!onChange) {
 router.push(next ? `/admin/audit-logs?action=${encodeURIComponent(next)}` : '/admin/audit-logs')
 } else { onChange(next) }
 }} icon={<History className="w-3.5 h-3.5" />} allLabel="การทำรายการทั้งหมด" />
}
