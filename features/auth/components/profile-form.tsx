'use client'

import { useActionState } from 'react'
import { KeyRound, Save, User } from 'lucide-react'
import { updatePersonalProfile, updatePersonalPassword } from '../actions'

interface ProfileFormProps {
  profile: {
    full_name: string
    email: string
    role: string
    is_active: boolean
    created_at?: string
  }
}

export function ProfileForm({ profile }: ProfileFormProps) {
  const [profileState, profileAction, isProfilePending] = useActionState(updatePersonalProfile, null)
  const [passwordState, passwordAction, isPasswordPending] = useActionState(updatePersonalPassword, null)

  const roleLabelMap: Record<string, string> = {
    admin: 'ผู้ดูแลระบบ (Admin)',
    staff: 'เจ้าหน้าที่ (Staff)',
    viewer: 'ผู้เข้าชม (Viewer)',
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-800">ตั้งค่าบัญชีส่วนบุคคล</h2>
        <p className="text-xs text-slate-500 mt-1">
          จัดการข้อมูลชื่อ-นามสกุล บัญชีผู้ใช้งาน และเปลี่ยนรหัสผ่านเพื่อความปลอดภัยในการใช้งานระบบ
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Summary Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col items-center text-center space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-500 text-3xl font-extrabold text-white shadow-md">
            {profile.full_name?.trim()?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">{profile.full_name}</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{profile.email}</p>
          </div>
          <div className="w-full border-t border-slate-100 pt-4 space-y-2.5 text-left text-xs text-slate-500">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-400">บทบาทสิทธิ์:</span>
              <span className="font-bold text-slate-700">{roleLabelMap[profile.role] || profile.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-400">สถานะบัญชี:</span>
              <span className="font-bold text-emerald-600">เปิดใช้งานปกติ</span>
            </div>
          </div>
        </div>

        {/* Edit Info Form */}
        <div className="md:col-span-2 space-y-6">
          {/* General Settings */}
          <form action={profileAction} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="h-4.5 w-4.5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">ข้อมูลส่วนตัวทั่วไป</h3>
            </div>

            {profileState?.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 animate-in fade-in duration-200">
                {profileState.error}
              </div>
            )}

            {profileState?.success && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700 animate-in fade-in duration-200">
                {profileState.success}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500" htmlFor="email">อีเมล (ไม่สามารถเปลี่ยนได้)</label>
                <input
                  id="email"
                  type="email"
                  defaultValue={profile.email}
                  disabled
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-400 cursor-not-allowed focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500" htmlFor="full_name">ชื่อ-นามสกุล *</label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  defaultValue={profile.full_name}
                  required
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isProfilePending}
                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isProfilePending ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}</span>
              </button>
            </div>
          </form>

          {/* Change Password Form */}
          <form action={passwordAction} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <KeyRound className="h-4.5 w-4.5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-800">เปลี่ยนรหัสผ่านใหม่</h3>
            </div>

            {passwordState?.error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 animate-in fade-in duration-200">
                {passwordState.error}
              </div>
            )}

            {passwordState?.success && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700 animate-in fade-in duration-200">
                {passwordState.success}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500" htmlFor="password">รหัสผ่านใหม่ *</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="ความยาวอย่างน้อย 6 ตัวอักษร"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500" htmlFor="confirm_password">ยืนยันรหัสผ่านใหม่ *</label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  required
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isPasswordPending}
                className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>{isPasswordPending ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'บันทึกรหัสผ่านใหม่'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
