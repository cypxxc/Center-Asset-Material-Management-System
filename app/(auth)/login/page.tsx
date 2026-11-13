'use client'

import { Suspense, useActionState, useEffect } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { login } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import { ArrowRight, Clock } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const isIdleTimeout = searchParams.get('reason') === 'idle_timeout'
  const [state, formAction, isPending] = useActionState(login, null)
  const error = state?.error ?? (errorParam ? 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง' : null)

  useEffect(() => {
    if (isIdleTimeout) {
      try {
        localStorage.removeItem('camms_last_activity')
        sessionStorage.clear()
      } catch {}
    }
  }, [isIdleTimeout])

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-12 text-foreground">
      <a
        href="#login-form"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        ข้ามไปฟอร์มเข้าสู่ระบบ
      </a>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex items-center justify-center p-2 rounded-2xl bg-card border border-border/70 shadow-xs">
            <Image
              src="/images/moph-r7-logo.webp"
              alt="ตราสัญลักษณ์ เขตสุขภาพที่ 7 กระทรวงสาธารณสุข"
              width={240}
              height={88}
              priority
              className="h-14 w-auto object-contain"
            />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">CAMMS Portal</h2>
            <p className="text-xs text-muted-foreground">ระบบบริหารจัดการครุภัณฑ์และพัสดุ เขตสุขภาพที่ 7</p>
          </div>
        </div>
      <form id="login-form" action={formAction} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">เข้าสู่ระบบ</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">จัดการทะเบียนพัสดุและติดตามข้อมูลของหน่วยงาน</p>
        </div>

        {isIdleTimeout && !error && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-800 dark:text-amber-300"
          >
            <Clock className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div>
              <p className="font-medium">เซสชันหมดอายุเนื่องจากไม่มีการใช้งาน</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5">เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่อีกครั้ง</p>
            </div>
          </div>
        )}

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
