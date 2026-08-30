'use client'

import React, { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
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
  RefreshCw,
  X,
  UserCheck,
  UserX,
} from 'lucide-react'
import { ProfileListItem } from '@/features/admin/queries'
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
import { cn } from '@/lib/utils'

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
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    icon: <ShieldCheck className="w-3.5 h-3.5 mr-1 text-blue-600" />,
  },
  staff: {
    label: 'เจ้าหน้าที่ (Staff)',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    icon: <Shield className="w-3.5 h-3.5 mr-1 text-emerald-600" />,
  },
  viewer: {
    label: 'ผู้เข้าชม (Viewer)',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700',
    icon: <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />,
  },
}

export default function UsersClient({
  currentUserId,
  initialProfiles,
  initialTotalCount,
  initialSearchParams,
}: UsersClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  // Filter States
  const [searchTerm, setSearchTerm] = useState(initialSearchParams.q)
  const [selectedRole, setSelectedRole] = useState(initialSearchParams.role)
  const [selectedStatus, setSelectedStatus] = useState(initialSearchParams.is_active)

  // Notification Banner
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'staff' as 'admin' | 'staff' | 'viewer',
    is_active: true,
  })

  // Role/Status Edit Confirmation
  const [pendingRoleStatusUpdate, setPendingRoleStatusUpdate] = useState<{
    profile: ProfileListItem
    newRole?: 'admin' | 'staff' | 'viewer'
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

  // Apply filters to URL
  const applyFilters = (q = searchTerm, role = selectedRole, is_active = selectedStatus) => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (role && role !== 'all') params.set('role', role)
    if (is_active && is_active !== 'all') params.set('is_active', is_active)
    params.set('page', '1')

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    applyFilters()
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setSelectedRole('all')
    setSelectedStatus('all')
    applyFilters('', 'all', 'all')
  }

  // Summary Metrics
  const totalCount = initialTotalCount
  const activeCount = initialProfiles.filter((p) => p.is_active).length
  const adminCount = initialProfiles.filter((p) => p.role === 'admin').length
  const staffCount = initialProfiles.filter((p) => p.role === 'staff').length
  const viewerCount = initialProfiles.filter((p) => p.role === 'viewer').length

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
          role: 'staff',
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

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '-'
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return isoString
    }
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
        subtitle="ศูนย์ควบคุมบัญชีผู้ใช้งาน สิทธิ์การเข้าถึงระบบ (Role-Based Access Control) และความปลอดภัย"
        actions={
          <Button
            type="button"
            onClick={() => {
              setNotice(null)
              setShowCreateModal(true)
            }}
            className="h-9 px-4 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
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
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
              : 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:border-rose-800 dark:text-rose-300'
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
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ผู้ใช้งานทั้งหมด</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-slate-100">{totalCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">เปิดใช้งานอยู่</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-700 dark:text-emerald-400">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">ผู้ดูแล (Admin)</p>
          <p className="mt-1 text-xl font-extrabold text-blue-700 dark:text-blue-400">{adminCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">เจ้าหน้าที่ (Staff)</p>
          <p className="mt-1 text-xl font-extrabold text-emerald-700 dark:text-emerald-400">{staffCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ผู้เข้าชม (Viewer)</p>
          <p className="mt-1 text-xl font-extrabold text-slate-700 dark:text-slate-300">{viewerCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ-นามสกุล หรือ อีเมล..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={isPending}
            className="h-9 px-3.5 font-bold text-xs cursor-pointer"
          >
            ค้นหา
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value)
              applyFilters(searchTerm, e.target.value, selectedStatus)
            }}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">บทบาททั้งหมด (All Roles)</option>
            <option value="admin">ผู้ดูแลระบบ (Admin)</option>
            <option value="staff">เจ้าหน้าที่ (Staff)</option>
            <option value="viewer">ผู้เข้าชม (Viewer)</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value)
              applyFilters(searchTerm, selectedRole, e.target.value)
            }}
            className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">สถานะทั้งหมด (All Status)</option>
            <option value="true">เปิดใช้งาน (Active)</option>
            <option value="false">ปิดการใช้งาน (Inactive)</option>
          </select>

          {(searchTerm || selectedRole !== 'all' || selectedStatus !== 'all') && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="h-9 px-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              ล้างตัวกรอง
            </Button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <th className="py-3 px-4">ผู้ใช้งาน (User)</th>
                <th className="py-3 px-4">อีเมล (Email)</th>
                <th className="py-3 px-4">บทบาทสิทธิ์ (Role)</th>
                <th className="py-3 px-4 text-center">สถานะบัญชี (Status)</th>
                <th className="py-3 px-4">วันที่ลงทะเบียน</th>
                <th className="py-3 px-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {initialProfiles.map((user) => {
                const isSelf = user.id === currentUserId
                const roleInfo = ROLE_CONFIG[user.role] || ROLE_CONFIG.viewer
                const initial = (user.full_name || user.email || 'U').charAt(0).toUpperCase()

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50/80 transition-colors dark:hover:bg-slate-800/40"
                  >
                    {/* User Name & Avatar */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700 text-xs shadow-2xs dark:bg-blue-900/50 dark:text-blue-300">
                          {initial}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {user.full_name || '(ไม่ระบุชื่อ)'}
                            </span>
                            {isSelf && (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-extrabold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                บัญชีคุณ
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">{user.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3 px-4">
                      <span className="font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                        {user.email || '-'}
                      </span>
                    </td>

                    {/* Role Dropdown */}
                    <td className="py-3 px-4">
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
                            const newRole = e.target.value as 'admin' | 'staff' | 'viewer'
                            if (newRole !== user.role) {
                              setPendingRoleStatusUpdate({
                                profile: user,
                                newRole,
                                newStatus: user.is_active,
                              })
                            }
                          }}
                          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                          <option value="staff">เจ้าหน้าที่ (Staff)</option>
                          <option value="viewer">ผู้เข้าชม (Viewer)</option>
                        </select>
                      )}
                    </td>

                    {/* Active Status */}
                    <td className="py-3 px-4 text-center">
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
                              newRole: user.role,
                              newStatus: !user.is_active,
                            })
                          }}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-all cursor-pointer',
                            user.is_active
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
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
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                      {formatDate(user.created_at)}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 text-right">
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
                          className="h-7 w-7 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer"
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
                          className="h-7 w-7 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </Button>

                        {!isSelf && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="ลบบัญชีผู้ใช้"
                            onClick={() => {
                              setNotice(null)
                              setDeleteTargetUser(user)
                            }}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {initialProfiles.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <UserX className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">ไม่พบข้อมูลผู้ใช้งาน</p>
                    <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองบทบาท</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create User */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">สร้างบัญชีผู้ใช้งานใหม่</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมชาย ใจดี"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  อีเมล (Email)
                </label>
                <input
                  type="email"
                  placeholder="user@example.com (เว้นว่างเพื่อสร้างอีเมลภายใน)"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  รหัสผ่านเริ่มต้น <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="ความยาวอย่างน้อย 6 ตัวอักษร"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  บทบาทหน้าที่ (Role)
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'staff' | 'viewer' })}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value="staff">เจ้าหน้าที่ (Staff) — บันทึก แก้ไข ขึ้นทะเบียนพัสดุ</option>
                  <option value="viewer">ผู้เข้าชม (Viewer) — ดูข้อมูลและรายงานเท่านั้น</option>
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
                <label htmlFor="create_is_active" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  เปิดใช้งานบัญชีทันที (Active)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isPending}
                  className="h-9 px-4 font-semibold text-xs cursor-pointer"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={isPending}
                  className="h-9 px-4 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
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
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">รีเซ็ตรหัสผ่านผู้ใช้งาน</h3>
                  <p className="text-[11px] text-slate-500">{resetTargetUser.full_name || resetTargetUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  รหัสผ่านใหม่ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="ความยาวอย่างน้อย 6 ตัวอักษร"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResetTargetUser(null)}
                  disabled={isPending}
                  className="h-9 px-4 font-semibold text-xs cursor-pointer"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={isPending}
                  className="h-9 px-4 font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
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
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">แก้ไขอีเมลผู้ใช้งาน</h3>
                  <p className="text-[11px] text-slate-500">{emailTargetUser.full_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmailTargetUser(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateEmail} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  อีเมลใหม่ (New Email Address) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-900 focus:border-amber-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailTargetUser(null)}
                  disabled={isPending}
                  className="h-9 px-4 font-semibold text-xs cursor-pointer"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={isPending}
                  className="h-9 px-4 font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
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
