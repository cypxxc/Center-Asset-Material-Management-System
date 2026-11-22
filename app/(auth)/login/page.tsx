'use client'

import { Suspense, useActionState, useEffect } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { login } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import { Clock } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const isIdleTimeout = searchParams.get('reason') === 'idle_timeout'
  const [state, formAction, isPending] = useActionState(login, null)
  const error = state?.error ?? (errorParam ? 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง' : null)

  useEffect(() => {
    // A new login starts a new idle period, independent of a previous session.
    try { localStorage.removeItem('camms_last_activity') } catch {}
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
      <div className="w-full max-w-xs sm:max-w-sm">
        <header className="mb-10 space-y-6 text-center">
          <div className="flex items-center justify-center">
            <Image
              src="/images/moph-r7-logo.webp"
              alt="ตราสัญลักษณ์ เขตสุขภาพที่ 7 กระทรวงสาธารณสุข"
              width={240}
              height={88}
              priority
              className="h-12 w-auto object-contain"
            />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Portal</h2>
            <h1 className="text-3xl font-semibold tracking-tight">เข้าสู่ระบบ</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              ระบบบริหารจัดการครุภัณฑ์และวัสดุ
              <span className="block">สำนักงานเขตสุขภาพที่ 7</span>
            </p>
          </div>
        </header>
      <form id="login-form" aria-label="เข้าสู่ระบบ" action={formAction} className="space-y-6">

        {isIdleTimeout && !error && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-800"
          >
            <Clock className="size-4 shrink-0 mt-0.5 text-amber-600" aria-hidden="true" />
            <div>
              <p className="font-medium">เซสชันหมดอายุเนื่องจากไม่มีการใช้งาน</p>
              <p className="text-xs text-amber-700/80 mt-0.5">เพื่อความปลอดภัย กรุณาเข้าสู่ระบบใหม่อีกครั้ง</p>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="relative">
        <input
          id="identifier"
          name="id"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck="false"
          placeholder="ชื่อผู้ใช้"
          required
          className="peer h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <label
          className="absolute left-3 top-0 -translate-y-1/2 cursor-text bg-background px-1 text-xs font-medium text-muted-foreground transition-all duration-150 peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-focus:top-0 peer-focus:text-xs peer-focus:text-foreground peer-autofill:top-0 peer-autofill:text-xs motion-reduce:transition-none"
          htmlFor="identifier"
        >
          ชื่อผู้ใช้
        </label>
        </div>
        <div className="relative">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="รหัสผ่าน"
          required
          className="peer h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <label
          className="absolute left-3 top-0 -translate-y-1/2 cursor-text bg-background px-1 text-xs font-medium text-muted-foreground transition-all duration-150 peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-focus:top-0 peer-focus:text-xs peer-focus:text-foreground peer-autofill:top-0 peer-autofill:text-xs motion-reduce:transition-none"
          htmlFor="password"
        >
          รหัสผ่าน
        </label>
        </div>
        <Button aria-busy={isPending} type="submit" disabled={isPending} className="h-12 w-full text-sm font-medium">
          {isPending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </Button>
      </form>
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
