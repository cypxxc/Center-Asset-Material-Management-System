'use client'

import { useActionState } from 'react'
import { KeyRound, Save, User } from 'lucide-react'
import {
  formatDisplayEmail,
  getInternalAccountHint,
  isInternalEmail,
} from '@/lib/display-email'
import { updatePersonalProfile, updatePersonalPassword } from '../actions'

interface ProfileFormProps {
  profile: {
    full_name: string
    display_name?: string | null
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

  const effectiveDisplayName = profile.display_name?.trim() || profile.full_name
  const displayEmail = formatDisplayEmail(profile.email)
  const internalAccount = isInternalEmail(profile.email)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Summary Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col items-center text-center space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-3xl font-extrabold text-white shadow-sm">
            {effectiveDisplayName?.trim()?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <h3 className="break-words text-base font-semibold text-foreground">{effectiveDisplayName}</h3>
            {profile.display_name && (
              <p className="text-xs text-muted-foreground mt-0.5">
                ชื่อเข้าสู่ระบบ: <span className="font-semibold text-foreground">{profile.full_name}</span>
              </p>
            )}
            <p className={internalAccount ? 'text-xs text-muted-foreground mt-0.5' : 'text-xs text-muted-foreground font-mono mt-0.5 break-all'}>
              {displayEmail}
            </p>
            {internalAccount && (
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{getInternalAccountHint()}</p>
            )}
          </div>
          <div className="w-full border-t border-border pt-4 space-y-2.5 text-left text-xs text-muted-foreground">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-semibold text-muted-foreground">บทบาทสิทธิ์:</span>
              <span className="font-bold text-foreground">{roleLabelMap[profile.role] || profile.role}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-semibold text-muted-foreground">สถานะบัญชี:</span>
              <span className="font-bold text-emerald-600">เปิดใช้งานปกติ</span>
            </div>
          </div>
        </div>

        {/* Edit Info Form */}
        <div className="md:col-span-2 space-y-6">
          {/* General Settings */}
          <form action={profileAction} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <User className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold text-foreground">ข้อมูลส่วนตัวทั่วไป</h3>
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
              {/* Display Name Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground" htmlFor="display_name">
                    ชื่อที่ใช้แสดงผลในระบบ (Display Name)
                  </label>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    กำหนดเองได้
                  </span>
                </div>
                <input
                  id="display_name"
                  name="display_name"
                  type="text"
                  defaultValue={profile.display_name ?? ''}
                  placeholder={`หากเว้นว่างจะแสดง "${profile.full_name}"`}
                  dir="auto"
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:border-blue-500 transition-all shadow-xs"
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ชื่อนี้จะใช้แสดงในเมนู แถบด้านข้าง และหน้าต่างๆ ในระบบ โดยไม่มีผลกระทบต่อชื่อที่ใช้ Login
                </p>
              </div>

              {/* Login Username (full_name) - Locked */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground" htmlFor="full_name_readonly">
                    ชื่อบัญชีสำหรับเข้าสู่ระบบ (สร้างโดยผู้ดูแลระบบ)
                  </label>
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    คงที่สำหรับ Login
                  </span>
                </div>
                <input
                  id="full_name_readonly"
                  type="text"
                  defaultValue={profile.full_name}
                  disabled
                  className="h-10 w-full rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed focus:outline-none"
                />
                <p className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed mt-1">
                  🔒 ชื่อนี้ถูกกำหนดโดยผู้ดูแลระบบและเป็นชื่อประจำตัวในการ Login เข้าสู่ระบบ เพื่อป้องกันปัญหาการลืมหรือเปลี่ยนชื่อจนเข้าสู่ระบบไม่ได้ หากต้องการแก้ไขชื่อนี้ กรุณาติดต่อผู้ดูแลระบบ
                </p>
              </div>

              {/* Email / Internal Account ID - Locked */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="email">
                  {internalAccount ? 'รหัสบัญชีภายในระบบ (Internal Account)' : 'อีเมลเข้าสู่ระบบ (ไม่สามารถเปลี่ยนได้)'}
                </label>
                <input
                  id="email"
                  type="text"
                  defaultValue={displayEmail}
                  disabled
                  className="h-10 w-full rounded-lg border border-border bg-muted px-3 text-xs text-muted-foreground cursor-not-allowed focus:outline-none"
                />
                {internalAccount && (
                  <p className="text-xs text-muted-foreground">{getInternalAccountHint()}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isProfilePending}
                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isProfilePending ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}</span>
              </button>
            </div>
          </form>

          {/* Change Password Form */}
          <form action={passwordAction} className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <KeyRound className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold text-foreground">เปลี่ยนรหัสผ่านใหม่</h3>
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
                <label className="text-sm font-medium text-muted-foreground" htmlFor="password">รหัสผ่านใหม่ *</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="ความยาวอย่างน้อย 6 ตัวอักษร"
                  className="h-10 w-full rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground focus:outline-none focus:border-blue-500 focus:bg-card transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground" htmlFor="confirm_password">ยืนยันรหัสผ่านใหม่ *</label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  required
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  className="h-10 w-full rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground focus:outline-none focus:border-blue-500 focus:bg-card transition-all"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isPasswordPending}
                className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-700 text-white text-sm font-medium transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
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
