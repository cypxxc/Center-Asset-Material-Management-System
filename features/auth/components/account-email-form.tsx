'use client'

import { useActionState } from 'react'
import { Mail } from 'lucide-react'
import { addPersonalEmail } from '../actions'

export function AccountEmailForm() {
  const [state, action, pending] = useActionState(addPersonalEmail, null)
  return (
    <form action={action} className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-bold"><Mail className="h-5 w-5 text-primary" />เพิ่มอีเมลสำหรับบัญชี</h2>
      <p className="text-xs text-muted-foreground">บัญชีนี้ยังไม่มีอีเมล เพิ่มอีเมลเพื่อใช้เข้าสู่ระบบได้</p>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p role="status" className="text-sm text-foreground">{state.success}</p>}
      {!state?.success && <>
        <div className="space-y-1.5">
          <label htmlFor="account-email" className="text-xs font-bold">อีเมล</label>
          <input id="account-email" name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending} placeholder="name@example.com" className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
        <div className="flex justify-end">
          <button aria-busy={pending} type="submit" disabled={pending} className="flex h-9 items-center gap-2 rounded-lg bg-primary hover:bg-primary/80 px-4 text-xs font-medium text-primary-foreground disabled:opacity-50">
            {pending ? 'กำลังบันทึก...' : 'บันทึกอีเมล'}
          </button>
        </div>
      </>}
    </form>
  )
}
