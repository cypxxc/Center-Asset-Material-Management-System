'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import { Package, ArrowRight } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const [state, formAction, isPending] = useActionState(login, null)
  const error = state?.error ?? (errorParam ? 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง' : null)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-12 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-blue-600 text-white"><Package className="size-6" aria-hidden="true" /></span>
          <div><h2 className="text-lg font-semibold tracking-tight">CAMMS Portal</h2><p className="text-xs text-muted-foreground">ระบบจัดการครุภัณฑ์และวัสดุ</p></div>
        </div>
      <form action={formAction} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">เข้าสู่ระบบ</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">จัดการทะเบียนพัสดุและติดตามข้อมูลของหน่วยงาน</p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="identifier">
          ชื่อผู้ใช้
        </label>
        <input
          id="identifier"
          name="id"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck="false"
          placeholder="ชื่อผู้ใช้"
          required
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        </div>
        <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="password">
          รหัสผ่าน
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="รหัสผ่าน"
          required
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        </div>
        <Button type="submit" disabled={isPending} className="h-11 w-full gap-2">
          {isPending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          {!isPending && <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">หากมีปัญหาในการเข้าใช้งาน กรุณาติดต่อผู้ดูแลระบบ</p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
