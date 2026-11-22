'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
 Users,
 UserPlus,
 Search,
 Shield,
 ShieldCheck,
 Eye,
 KeyRound,
 Mail,
 Trash2,
 CheckCircle2,
 AlertCircle,
 X,
 UserCheck,
 UserX,
} from 'lucide-react'
import type { ProfileListItem } from '@/features/admin/types'
import { useUsersFilter } from '@/features/admin/hooks/use-users-filter'
import {
 createAuthUser,
 deleteAuthUser,
 resetAuthPassword,
 updateUserEmail,
 updateUserProfileRoleAndStatus,
} from '@/features/admin/actions'
import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
 DataTable,
 DataTableHeader,
 DataTableHead,
 DataTableBody,
 DataTableRow,
 DataTableCell,
} from '@/components/ui/data-table'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/date'
import { FilterDropdown, type FilterOption } from '@/components/ui/filter-dropdown'

interface UsersClientProps {
 currentUserId: string
 initialProfiles: ProfileListItem[]
 initialTotalCount: number
 initialSearchParams: {
 q: string
 role: string
 is_active: string
 page: number
 pageSize: number
 }
}

const ROLE_CONFIG: Record<
 string,
 { label: string; badgeClass: string; icon: React.ReactNode }
> = {
 admin: {
 label: 'ผู้ดูแลระบบ (Admin)',
 badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 ',
 icon: <ShieldCheck className="w-3.5 h-3.5 mr-1 text-blue-600" />,
 },
 user: {
 label: 'ผู้ใช้งานทั่วไป (User)',
 badgeClass: 'bg-slate-50 text-slate-700 border-slate-200 ',
 icon: <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />,
 },
}

const ROLE_FILTER_OPTIONS: FilterOption[] = [
 { value: 'admin', label: 'ผู้ดูแลระบบ (Admin)', icon: <ShieldCheck className="h-3.5 w-3.5 text-blue-500" /> },
 { value: 'user', label: 'ผู้ใช้งานทั่วไป (User)', icon: <Eye className="h-3.5 w-3.5 text-slate-500" /> },
]

const STATUS_FILTER_OPTIONS: FilterOption[] = [
 { value: 'true', label: 'เปิดใช้งาน (Active)', colorDot: 'bg-emerald-500' },
 { value: 'false', label: 'ปิดการใช้งาน (Inactive)', colorDot: 'bg-rose-500' },
]

export default function UsersClient({
 currentUserId,
 initialProfiles,
 initialTotalCount,
 initialSearchParams,
}: UsersClientProps) {
 const router = useRouter()
 const {
 searchTerm,
 setSearchTerm,
 selectedRole,
 setSelectedRole,
 selectedStatus,
 setSelectedStatus,
 isPending,
 startTransition,
 applyFilters,
 handleSearchSubmit,
 handleClearFilters,
 } = useUsersFilter(initialSearchParams)

 // Notification Banner
 const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

 // Modal States
 const [showCreateModal, setShowCreateModal] = useState(false)
 const [createForm, setCreateForm] = useState({
 full_name: '',
 email: '',
 password: '',
 role: 'user' as 'admin' | 'user',
 is_active: true,
 })

 // Role/Status Edit Confirmation
 const [pendingRoleStatusUpdate, setPendingRoleStatusUpdate] = useState<{
 profile: ProfileListItem
 newRole?: 'admin' | 'user'
 newStatus?: boolean
 } | null>(null)

 // Password Reset Modal
 const [resetTargetUser, setResetTargetUser] = useState<ProfileListItem | null>(null)
 const [newPasswordInput, setNewPasswordInput] = useState('')

 // Email Update Modal
 const [emailTargetUser, setEmailTargetUser] = useState<ProfileListItem | null>(null)
 const [newEmailInput, setNewEmailInput] = useState('')

 // Delete User Confirmation
 const [deleteTargetUser, setDeleteTargetUser] = useState<ProfileListItem | null>(null)

 // Summary Metrics
 const totalCount = initialTotalCount
 const activeCount = initialProfiles.filter((p) => p.is_active).length
 const adminCount = initialProfiles.filter((p) => p.role === 'admin').length
 const userCount = initialProfiles.filter((p) => p.role === 'user').length

 // Quick Action Handlers
 const handleConfirmRoleStatusChange = () => {
 if (!pendingRoleStatusUpdate) return
 const { profile, newRole, newStatus } = pendingRoleStatusUpdate

 startTransition(async () => {
 const res = await updateUserProfileRoleAndStatus(profile.id, {
 role: newRole,
 is_active: newStatus,
 })
 if (res.success) {
 setNotice({ type: 'success', message: `อัปเดตสิทธิ์ของ "${profile.full_name || profile.email}" เรียบร้อยแล้ว` })
 setPendingRoleStatusUpdate(null)
 router.refresh()
 } else {
 setNotice({ type: 'error', message: res.error || 'เกิดข้อผิดพลาดในการอัปเดต' })
 setPendingRoleStatusUpdate(null)
 }
 })
 }

 const handleCreateUser = (e: React.FormEvent) => {
 e.preventDefault()
 if (!createForm.full_name.trim()) {
 setNotice({ type: 'error', message: 'กรุณากรอกชื่อ-นามสกุล' })
 return
 }
 if (!createForm.password || createForm.password.length < 6) {
 setNotice({ type: 'error', message: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร' })
 return
 }

 startTransition(async () => {
 const res = await createAuthUser({
 full_name: createForm.full_name.trim(),
 email: createForm.email.trim() || undefined,
 password: createForm.password,
 role: createForm.role,
 is_active: createForm.is_active,
 })

 if (res.success) {
 setNotice({ type: 'success', message: `สร้างบัญชีผู้ใช้ "${createForm.full_name}" สำเร็จเรียบร้อย` })
 setShowCreateModal(false)
 setCreateForm({
 full_name: '',
 email: '',
 password: '',
 role: 'user',
 is_active: true,
 })
 router.refresh()
 } else {
 setNotice({ type: 'error', message: res.error || 'สร้างบัญชีผู้ใช้ไม่สำเร็จ' })
 }
 })
 }

 const handleResetPassword = (e: React.FormEvent) => {
 e.preventDefault()
 if (!resetTargetUser) return
 if (!newPasswordInput || newPasswordInput.length < 6) {
 setNotice({ type: 'error', message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' })
 return
 }

 startTransition(async () => {
 const res = await resetAuthPassword(resetTargetUser.id, newPasswordInput)
 if (res.success) {
 setNotice({ type: 'success', message: `รีเซ็ตรหัสผ่านสำหรับ "${resetTargetUser.full_name || resetTargetUser.email}" สำเร็จ` })
 setResetTargetUser(null)
 setNewPasswordInput('')
 } else {
 setNotice({ type: 'error', message: res.error || 'รีเซ็ตรหัสผ่านไม่สำเร็จ' })
 }
 })
 }

 const handleUpdateEmail = (e: React.FormEvent) => {
 e.preventDefault()
 if (!emailTargetUser) return
 if (!newEmailInput || !newEmailInput.includes('@')) {
 setNotice({ type: 'error', message: 'กรุณาระบุอีเมลที่ถูกต้อง' })
 return
 }

 startTransition(async () => {
 const res = await updateUserEmail(emailTargetUser.id, newEmailInput)
 if (res.success) {
 setNotice({ type: 'success', message: `เปลี่ยนอีเมลเป็น "${newEmailInput}" สำเร็จเรียบร้อย` })
 setEmailTargetUser(null)
 setNewEmailInput('')
 router.refresh()
 } else {
 setNotice({ type: 'error', message: res.error || 'เปลี่ยนอีเมลไม่สำเร็จ' })
 }
 })
 }

 const handleDeleteUser = () => {
 if (!deleteTargetUser) return

 startTransition(async () => {
 const res = await deleteAuthUser(deleteTargetUser.id)
 if (res.success) {
 setNotice({ type: 'success', message: `ลบบัญชีผู้ใช้ "${deleteTargetUser.full_name || deleteTargetUser.email}" เรียบร้อยแล้ว` })
 setDeleteTargetUser(null)
 router.refresh()
 } else {
 setNotice({ type: 'error', message: res.error || 'ไม่สามารถลบบัญชีผู้ใช้ได้' })
 setDeleteTargetUser(null)
 }
 })
 }


 return (
 <PageContainer>
 <PageHeader
 title={
 <div className="flex items-center gap-2">
 <Users className="h-6 w-6 text-blue-600" />
 <span>จัดการผู้ใช้งานและกำหนดสิทธิ์</span>
 </div>
 }
 actions={
 <Button variant="outline-primary"
 type="button"
 onClick={() => {
 setNotice(null)
 setShowCreateModal(true)
 }}
 className="h-9 px-4 text-xs rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
 >
 <span>เพิ่มผู้ใช้งานใหม่</span>
 </Button>
 }
 />

 {/* Notice Banner */}
 {notice && (
 <div
 className={cn(
 'flex items-center justify-between rounded-lg border px-4 py-3 text-xs font-semibold animate-in fade-in duration-200',
 notice.type === 'success'
 ? 'border-emerald-200 bg-emerald-50 text-emerald-700 '
 : 'border-rose-200 bg-rose-50 text-rose-700 '
 )}
 >
 <div className="flex items-center gap-2">
 {notice.type === 'success' ? (
 <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
 ) : (
 <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
 )}
 <span>{notice.message}</span>
 </div>
 <button
 type="button"
 onClick={() => setNotice(null)}
 className="text-slate-400 hover:text-slate-600 cursor-pointer"
 >
 <X className="h-4 w-4" />
 </button>
 </div>
 )}

 {/* KPI Cards */}
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
 <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs ">
 <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ผู้ใช้งานทั้งหมด</p>
 <p className="mt-1 text-xl font-extrabold text-slate-900 ">{totalCount}</p>
 </div>
 <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs ">
 <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">เปิดใช้งานอยู่</p>
 <p className="mt-1 text-xl font-extrabold text-emerald-700 ">{activeCount}</p>
 </div>
 <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs ">
 <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">ผู้ดูแล (Admin)</p>
 <p className="mt-1 text-xl font-extrabold text-blue-700 ">{adminCount}</p>
 </div>
 <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs ">
 <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ผู้ใช้งานทั่วไป (User)</p>
 <p className="mt-1 text-xl font-extrabold text-slate-700 ">{userCount}</p>
 </div>
 </div>

 {/* Filter and Search Bar */}
 <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between ">
 <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
 <input
 type="text"
 placeholder="ค้นหาชื่อ-นามสกุล หรือ อีเมล..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none "
 />
 </div>
 <Button
 aria-busy={isPending}
 type="submit"
 variant="default"
 size="sm"
 disabled={isPending}
 className="h-9 px-3.5 text-xs cursor-pointer"
 >
 ค้นหา
 </Button>
 </form>

 <div className="flex flex-wrap items-center gap-2">
 <FilterDropdown
 label="บทบาท"
 ariaLabel="กรองตามบทบาท"
 name="role"
 value={selectedRole === 'all' ? '' : selectedRole}
 options={ROLE_FILTER_OPTIONS}
 onChange={(val) => {
 const next = val || 'all'
 setSelectedRole(next)
 applyFilters({ role: next })
 }}
 icon={<Shield className="h-3.5 w-3.5" />}
 allLabel="บทบาททั้งหมด"
 />

 <FilterDropdown
 label="สถานะ"
 ariaLabel="กรองตามสถานะ"
 name="is_active"
 value={selectedStatus === 'all' ? '' : selectedStatus}
 options={STATUS_FILTER_OPTIONS}
 onChange={(val) => {
 const next = val || 'all'
 setSelectedStatus(next)
 applyFilters({ is_active: next })
 }}
 icon={<UserCheck className="h-3.5 w-3.5" />}
 allLabel="สถานะทั้งหมด"
 />

 {(searchTerm || selectedRole !== 'all' || selectedStatus !== 'all') && (
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={handleClearFilters}
 className="h-9 px-2.5 text-xs cursor-pointer"
 >
 ล้างตัวกรอง
 </Button>
 )}
 </div>
 </div>

 {/* Users Table */}
 <DataTable>
 <DataTableHeader>
 <tr>
 <DataTableHead>ผู้ใช้งาน (User)</DataTableHead>
 <DataTableHead>อีเมล (Email)</DataTableHead>
 <DataTableHead>บทบาทสิทธิ์ (Role)</DataTableHead>
 <DataTableHead className="text-center">สถานะบัญชี (Status)</DataTableHead>
 <DataTableHead>วันที่ลงทะเบียน</DataTableHead>
 <DataTableHead isActions>การจัดการ</DataTableHead>
 </tr>
 </DataTableHeader>
 <DataTableBody className="font-medium">
 {initialProfiles.map((user) => {
 const isSelf = user.id === currentUserId
 const roleInfo = ROLE_CONFIG[user.role] || ROLE_CONFIG.user
 const initial = (user.full_name || user.email || 'U').charAt(0).toUpperCase()

 return (
 <DataTableRow
 key={user.id}
 >
 {/* User Name & Avatar */}
 <DataTableCell>
 <div className="flex items-center gap-3">
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 text-xs shadow-2xs ">
 {initial}
 </div>
 <div>
 <div className="flex items-center gap-1.5">
 <span className="font-bold text-foreground">
 {user.full_name || '(ไม่ระบุชื่อ)'}
 </span>
 {isSelf && (
 <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-extrabold text-blue-700 ">
 บัญชีคุณ
 </span>
 )}
 </div>
 <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{user.id.slice(0, 8)}...</p>
 </div>
 </div>
 </DataTableCell>

 {/* Email */}
 <DataTableCell>
 <span className="font-mono text-muted-foreground text-[11px]">
 {user.email || 'ยังไม่มีอีเมล'}
 </span>
 </DataTableCell>

 {/* Role Dropdown */}
 <DataTableCell>
 {isSelf ? (
 <span
 className={cn(
 'inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold',
 roleInfo.badgeClass
 )}
 >
 {roleInfo.icon}
 {roleInfo.label}
 </span>
 ) : (
 <select
 value={user.role}
 disabled={isPending}
 onChange={(e) => {
 const newRole = e.target.value as 'admin' | 'user'
 if (newRole !== user.role) {
 setPendingRoleStatusUpdate({
 profile: user,
 newRole,
 newStatus: user.is_active,
 })
 }
 }}
 className="h-8 rounded-lg border border-input bg-card px-2 text-xs font-semibold text-foreground focus:border-ring focus:outline-none cursor-pointer"
 >
 <option value="admin">ผู้ดูแลระบบ (Admin)</option>
 <option value="user">ผู้ใช้งานทั่วไป (User)</option>
 </select>
 )}
 </DataTableCell>

 {/* Active Status */}
 <DataTableCell className="text-center">
 {isSelf ? (
 <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
 <UserCheck className="h-3.5 w-3.5" />
 <span>เปิดใช้งาน</span>
 </span>
 ) : (
 <button
 type="button"
 disabled={isPending}
 onClick={() => {
 setPendingRoleStatusUpdate({
 profile: user,
 newStatus: !user.is_active,
 })
 }}
 className={cn(
 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer',
 user.is_active
 ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 '
 : 'border-border bg-muted text-muted-foreground hover:bg-muted/80'
 )}
 >
 {user.is_active ? (
 <>
 <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
 <span>เปิดใช้งาน</span>
 </>
 ) : (
 <>
 <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
 <span>ปิดใช้งาน</span>
 </>
 )}
 </button>
 )}
 </DataTableCell>

 {/* Created Date */}
 <DataTableCell className="text-muted-foreground text-[11px]">
 {formatDate(user.created_at) || '-'}
 </DataTableCell>

 {/* Action buttons */}
 <DataTableCell isActions>
 <div className="flex items-center justify-end gap-1">
 <Button
 type="button"
 variant="ghost"
 size="icon"
 title="รีเซ็ตรหัสผ่าน"
 onClick={() => {
 setNotice(null)
 setResetTargetUser(user)
 setNewPasswordInput('')
 }}
 className="h-7 w-7 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
 >
 <KeyRound className="h-3.5 w-3.5" />
 </Button>

 <Button
 type="button"
 variant="ghost"
 size="icon"
 title="แก้ไขอีเมล"
 onClick={() => {
 setNotice(null)
 setEmailTargetUser(user)
 setNewEmailInput(user.email || '')
 }}
 className="h-7 w-7 text-muted-foreground hover:text-amber-600 hover:bg-amber-50 cursor-pointer"
 >
 <Mail className="h-3.5 w-3.5" />
 </Button>

 {!isSelf && (
 <Button
 type="button"
 variant="destructive"
 size="icon"
 title="ลบบัญชีผู้ใช้"
 onClick={() => {
 setNotice(null)
 setDeleteTargetUser(user)
 }}
 className="h-7 w-7 cursor-pointer"
 >
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 )}
 </div>
 </DataTableCell>
 </DataTableRow>
 )
 })}

 {initialProfiles.length === 0 && (
 <tr>
 <td colSpan={6} className="py-12 text-center text-muted-foreground">
 <UserX className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-60" />
 <p className="text-sm font-bold text-foreground">ไม่พบข้อมูลผู้ใช้งาน</p>
 <p className="text-xs text-muted-foreground mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองบทบาท</p>
 </td>
 </tr>
 )}
 </DataTableBody>
 </DataTable>

 {/* Modal: Create User */}
 {showCreateModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
 <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-150">
 <div className="flex items-center justify-between pb-3 border-b border-slate-100 ">
 <div className="flex items-center gap-2">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ">
 <UserPlus className="h-4 w-4" />
 </div>
 <h3 className="text-sm font-bold text-slate-900 ">สร้างบัญชีผู้ใช้งานใหม่</h3>
 </div>
 <button
 type="button"
 onClick={() => setShowCreateModal(false)}
 className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
 >
 <X className="h-4 w-4" />
 </button>
 </div>

 <form onSubmit={handleCreateUser} className="mt-4 space-y-3.5">
 <div>
 <label className="block text-xs font-bold text-slate-700 mb-1">
 ชื่อ-นามสกุล <span className="text-rose-500">*</span>
 </label>
 <input
 type="text"
 required
 placeholder="เช่น สมชาย ใจดี"
 value={createForm.full_name}
 onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
 className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none "
 />
 </div>

 <div>
 <label className="block text-xs font-bold text-slate-700 mb-1">
 อีเมล (Email)
 </label>
 <input
 type="email"
 placeholder="user@example.com (เว้นว่างได้ เพิ่มภายหลัง)"
 value={createForm.email}
 onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
 className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none font-mono"
 />
 </div>

 <div>
 <label className="block text-xs font-bold text-slate-700 mb-1">
 รหัสผ่านเริ่มต้น <span className="text-rose-500">*</span>
 </label>
 <input
 type="password"
 required
 minLength={6}
 placeholder="ความยาวอย่างน้อย 6 ตัวอักษร"
 value={createForm.password}
 onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
 className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none "
 />
 </div>

 <div>
 <label className="block text-xs font-bold text-slate-700 mb-1">
 บทบาทหน้าที่ (Role)
 </label>
 <select
 value={createForm.role}
 onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'user' })}
 className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none cursor-pointer"
 >
 <option value="user">ผู้ใช้งานทั่วไป (User) — ดูข้อมูลและรายงานเท่านั้น</option>
 <option value="admin">ผู้ดูแลระบบ (Admin) — สิทธิ์เต็มทุกส่วน</option>
 </select>
 </div>

 <div className="flex items-center gap-2 pt-1">
 <input
 type="checkbox"
 id="create_is_active"
 checked={createForm.is_active}
 onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })}
 className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
 />
 <label htmlFor="create_is_active" className="text-xs font-semibold text-slate-700 cursor-pointer">
 เปิดใช้งานบัญชีทันที (Active)
 </label>
 </div>

 <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 ">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => setShowCreateModal(false)}
 disabled={isPending}
 className="h-9 px-4 text-xs cursor-pointer"
 >
 ยกเลิก
 </Button>
 <Button
 aria-busy={isPending}
 type="submit"
 size="sm"
 disabled={isPending}
 className="h-9 px-4 text-xs cursor-pointer"
 >
 {isPending ? 'กำลังสร้าง...' : 'สร้างบัญชีผู้ใช้'}
 </Button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Modal: Reset Password */}
 {resetTargetUser && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
 <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-150">
 <div className="flex items-center justify-between pb-3 border-b border-slate-100 ">
 <div className="flex items-center gap-2">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ">
 <KeyRound className="h-4 w-4" />
 </div>
 <div>
 <h3 className="text-sm font-bold text-slate-900 ">รีเซ็ตรหัสผ่านผู้ใช้งาน</h3>
 <p className="text-[11px] text-slate-500">{resetTargetUser.full_name || resetTargetUser.email}</p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => setResetTargetUser(null)}
 className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
 >
 <X className="h-4 w-4" />
 </button>
 </div>

 <form onSubmit={handleResetPassword} className="mt-4 space-y-3.5">
 <div>
 <label className="block text-xs font-bold text-slate-700 mb-1">
 รหัสผ่านใหม่ <span className="text-rose-500">*</span>
 </label>
 <input
 type="password"
 required
 minLength={6}
 placeholder="ความยาวอย่างน้อย 6 ตัวอักษร"
 value={newPasswordInput}
 onChange={(e) => setNewPasswordInput(e.target.value)}
 className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none "
 />
 </div>

 <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 ">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => setResetTargetUser(null)}
 disabled={isPending}
 className="h-9 px-4 text-xs cursor-pointer"
 >
 ยกเลิก
 </Button>
 <Button
 aria-busy={isPending}
 type="submit"
 size="sm"
 disabled={isPending}
 className="h-9 px-4 text-xs cursor-pointer"
 >
 {isPending ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
 </Button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Modal: Update Email */}
 {emailTargetUser && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
 <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-150">
 <div className="flex items-center justify-between pb-3 border-b border-slate-100 ">
 <div className="flex items-center gap-2">
 <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 ">
 <Mail className="h-4 w-4" />
 </div>
 <div>
 <h3 className="text-sm font-bold text-slate-900 ">แก้ไขอีเมลผู้ใช้งาน</h3>
 <p className="text-[11px] text-slate-500">{emailTargetUser.full_name}</p>
 </div>
 </div>
 <button
 type="button"
 onClick={() => setEmailTargetUser(null)}
 className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
 >
 <X className="h-4 w-4" />
 </button>
 </div>

 <form onSubmit={handleUpdateEmail} className="mt-4 space-y-3.5">
 <div>
 <label className="block text-xs font-bold text-slate-700 mb-1">
 อีเมลใหม่ (New Email Address) <span className="text-rose-500">*</span>
 </label>
 <input
 type="email"
 required
 placeholder="user@example.com"
 value={newEmailInput}
 onChange={(e) => setNewEmailInput(e.target.value)}
 className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none font-mono"
 />
 </div>

 <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 ">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => setEmailTargetUser(null)}
 disabled={isPending}
 className="h-9 px-4 text-xs cursor-pointer"
 >
 ยกเลิก
 </Button>
 <Button
 aria-busy={isPending}
 type="submit"
 size="sm"
 disabled={isPending}
 className="h-9 px-4 text-xs cursor-pointer"
 >
 {isPending ? 'กำลังบันทึก...' : 'บันทึกอีเมล'}
 </Button>
 </div>
 </form>
 </div>
 </div>
 )}

 {/* Confirm Dialog: Role / Status Change */}
 <ConfirmDialog
 open={pendingRoleStatusUpdate !== null}
 title="ยืนยันการเปลี่ยนแปลงสิทธิ์ผู้ใช้งาน"
 description={
 pendingRoleStatusUpdate
 ? `คุณต้องการเปลี่ยนสิทธิ์ของ "${pendingRoleStatusUpdate.profile.full_name || pendingRoleStatusUpdate.profile.email}" เป็นบทบาท ${
 ROLE_CONFIG[pendingRoleStatusUpdate.newRole || pendingRoleStatusUpdate.profile.role]?.label
 } (${pendingRoleStatusUpdate.newStatus ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}) ใช่หรือไม่?`
 : ''
 }
 confirmText="ยืนยันการเปลี่ยนสิทธิ์"
 cancelText="ยกเลิก"
 variant="default"
 isPending={isPending}
 onConfirm={handleConfirmRoleStatusChange}
 onCancel={() => setPendingRoleStatusUpdate(null)}
 />

 {/* Confirm Dialog: Delete User */}
 <ConfirmDialog
 open={deleteTargetUser !== null}
 title="ยืนยันการลบบัญชีผู้ใช้ถาวร"
 description={
 deleteTargetUser
 ? `คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีของ "${deleteTargetUser.full_name || deleteTargetUser.email}" ออกจากระบบถาวร? การกระทำนี้ไม่สามารถเรียกคืนได้`
 : ''
 }
 confirmText="ลบบัญชีผู้ใช้"
 cancelText="ยกเลิก"
 variant="destructive"
 isPending={isPending}
 onConfirm={handleDeleteUser}
 onCancel={() => setDeleteTargetUser(null)}
 />
 </PageContainer>
 )
}
