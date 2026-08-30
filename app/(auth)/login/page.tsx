'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const [state, formAction, isPending] = useActionState(login, null)
  const error = state?.error ?? (errorParam ? 'ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง' : null)

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <form action={formAction} className="w-full max-w-xs space-y-3">
        <h1 className="pb-1 text-center text-base font-semibold">CAMMS Portal</h1>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <label className="sr-only" htmlFor="identifier">
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

        <label className="sr-only" htmlFor="password">
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

        <Button type="submit" disabled={isPending} className="h-10 w-full">
          {isPending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </Button>
      </form>
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
