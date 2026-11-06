'use client'

import { useActionState, useState } from 'react'
import { KeyRound, Save, User, Loader2, ShieldCheck } from 'lucide-react'
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
  const [newPassword, setNewPassword] = useState('')

  const passwordStrength = (() => {
    if (!newPassword) return 0
    let score = 0
    if (newPassword.length >= 6) score += 1
    if (newPassword.length >= 8) score += 1
    if (/[0-9!@#$%^&*(),.?":{}|<>]/.test(newPassword)) score += 1
    return score
  })()

  const strengthLabels = ['', 'ระดับง่าย (ควรเพิ่มตัวเลข/อักขระพิเศษ)', 'ระดับปานกลาง', 'ระดับปลอดภัยสูง']
  const strengthColors = ['', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500']

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
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs flex flex-col items-center text-center space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-3xl font-extrabold text-primary-foreground shadow-xs">
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
              <span className="font-bold text-emerald-600 dark:text-emerald-400">เปิดใช้งานปกติ</span>
            </div>
          </div>
        </div>

        {/* Edit Info Form */}
        <div className="md:col-span-2 space-y-6">
          {/* General Settings */}
          <form action={profileAction} className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <User className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">ข้อมูลส่วนตัวทั่วไป</h3>
            </div>

            {profileState?.error && (
              <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-xs font-semibold text-destructive animate-in fade-in duration-200">
                {profileState.error}
              </div>
            )}

            {profileState?.success && (
              <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
                {profileState.success}
              </div>
            )}

            <div className="space-y-4">
              {/* Display Name Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground" htmlFor="display_name">
                    ชื่อที่ใช้แสดงผลในระบบ (Display Name)
                  </label>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    กำหนดเองได้
                  </span>
                </div>
                <input
                  id="display_name"
                  name="display_name"
                  type="text"
                  autoComplete="name"
                  defaultValue={profile.display_name ?? ''}
                  placeholder={`หากเว้นว่างจะแสดง "${profile.full_name}"`}
                  dir="auto"
                  className="h-10 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-2xs"
                />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ชื่อนี้จะใช้แสดงในเมนู แถบด้านข้าง และหน้าต่างๆ ในระบบ โดยไม่มีผลกระทบต่อชื่อที่ใช้ Login
                </p>
              </div>

              {/* Login Username (full_name) - Locked */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground" htmlFor="full_name_readonly">
                    ชื่อบัญชีสำหรับเข้าสู่ระบบ (สร้างโดยผู้ดูแลระบบ)
                  </label>
                  <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                    คงที่สำหรับ Login
                  </span>
                </div>
                <input
                  id="full_name_readonly"
                  type="text"
                  defaultValue={profile.full_name}
                  disabled
                  className="h-10 w-full rounded-lg border border-border bg-muted px-3 text-xs text-muted-foreground cursor-not-allowed focus:outline-none"
                />
                <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg border border-border leading-relaxed mt-1">
                  🔒 ชื่อนี้ถูกกำหนดโดยผู้ดูแลระบบและเป็นชื่อประจำตัวในการ Login เข้าสู่ระบบ เพื่อป้องกันปัญหาการลืมหรือเปลี่ยนชื่อจนเข้าสู่ระบบไม่ได้ หากต้องการแก้ไขชื่อนี้ กรุณาติดต่อผู้ดูแลระบบ
                </p>
              </div>

              {/* Email / Internal Account ID - Locked */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground" htmlFor="email">
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
                className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                {isProfilePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{isProfilePending ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}</span>
              </button>
            </div>
          </form>

          {/* Change Password Form */}
          <form action={passwordAction} className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <KeyRound className="h-5 w-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">เปลี่ยนรหัสผ่านใหม่</h3>
            </div>

            {passwordState?.error && (
              <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-xs font-semibold text-destructive animate-in fade-in duration-200">
                {passwordState.error}
              </div>
            )}

            {passwordState?.success && (
              <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
                {passwordState.success}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground" htmlFor="password">รหัสผ่านใหม่ *</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="ความยาวอย่างน้อย 6 ตัวอักษร"
                  className="h-10 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-2xs"
                />
                {newPassword.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div className="flex gap-1 h-1.5 w-full">
                      <div className={`flex-1 rounded-full ${passwordStrength >= 1 ? strengthColors[passwordStrength] : 'bg-muted'}`} />
                      <div className={`flex-1 rounded-full ${passwordStrength >= 2 ? strengthColors[passwordStrength] : 'bg-muted'}`} />
                      <div className={`flex-1 rounded-full ${passwordStrength >= 3 ? strengthColors[passwordStrength] : 'bg-muted'}`} />
                    </div>
                    <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      <span>{strengthLabels[passwordStrength]}</span>
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground" htmlFor="confirm_password">ยืนยันรหัสผ่านใหม่ *</label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  className="h-10 w-full rounded-lg border border-input bg-card px-3 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-2xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isPasswordPending}
                className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                {isPasswordPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                <span>{isPasswordPending ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'บันทึกรหัสผ่านใหม่'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
