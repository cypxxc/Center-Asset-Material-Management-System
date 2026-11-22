'use client'

import { useActionState, useState } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { updatePersonalPassword } from '../actions'

export function ChangePasswordForm() {
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

 return (
 <div className="mx-auto w-full max-w-2xl">
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
 <div role="status" className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-600 animate-in fade-in duration-200">
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
 <button aria-busy={isPasswordPending}
 type="submit"
 disabled={isPasswordPending}
 className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-medium transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
 >
 <span>{isPasswordPending ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'บันทึกรหัสผ่านใหม่'}</span>
 </button>
 </div>
 </form>
 </div>
 )
}
