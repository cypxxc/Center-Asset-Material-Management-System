'use client'

import { Suspense, useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import {
  Package,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const [state, formAction, isPending] = useActionState(login, null)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center bg-slate-50/70 text-slate-900 font-sans selection:bg-blue-600 selection:text-white px-4 py-8 sm:px-6 sm:py-10 overflow-hidden">
      {/* Subtle Ambient Mesh Aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden"
      >
        <div className="absolute -top-[15%] left-1/2 -translate-x-1/2 h-[480px] w-[620px] rounded-full bg-gradient-to-tr from-blue-200/40 via-indigo-100/30 to-sky-100/50 blur-[100px]" />
        <div className="absolute -bottom-[20%] right-[10%] h-[380px] w-[420px] rounded-full bg-gradient-to-br from-indigo-100/40 via-sky-100/30 to-transparent blur-[90px]" />
      </div>

      {/* Top Header */}
      <header className="w-full max-w-[400px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
            <Package className="h-4.5 w-4.5" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-slate-900 block leading-none">
              CAMMS Portal
            </span>
            <span className="text-[10px] text-slate-700 font-medium leading-none">
              Center Asset & Material Management System
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium bg-white/70 backdrop-blur-xs border border-slate-200/60 px-2.5 py-1 rounded-full shadow-2xs">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-[11px]">256-bit Encrypted</span>
        </div>
      </header>

      {/* Center Frosted Glass Card */}
      <main id="main-content" className="w-full max-w-[400px] my-auto py-6">
        <div className="rounded-3xl bg-white/85 backdrop-blur-xl border border-white/80 shadow-[0_8px_32px_rgba(15,23,42,0.06),0_1px_2px_rgba(0,0,0,0.04)] p-7 sm:p-9 space-y-6">
          {/* Headline block */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50/80 border border-blue-100/70 text-blue-800 text-[11px] font-semibold tracking-wide">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
              ยินดีต้อนรับเข้าสู่ระบบ • OFFICIAL PORTAL
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              เข้าสู่ระบบจัดการพัสดุและครุภัณฑ์
            </h1>
            <p className="text-xs text-slate-700 font-medium">
              กรอกข้อมูลบัญชีเพื่อเข้าใช้งานระบบ
            </p>
          </div>

          {/* SSO / Account Error alerts */}
          {errorParam && (
            <div
              role="alert"
              className={`flex items-start gap-2.5 rounded-2xl border p-3.5 text-xs animate-in fade-in ${
                errorParam === 'inactive'
                  ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                  : 'bg-rose-50/90 border-rose-200 text-rose-900'
              }`}
            >
              <AlertCircle
                className={`h-4 w-4 shrink-0 mt-0.5 ${
                  errorParam === 'inactive' ? 'text-amber-600' : 'text-rose-600'
                }`}
              />
              <div className="space-y-0.5">
                <p className="font-semibold text-slate-950">
                  {errorParam === 'inactive'
                    ? 'บัญชีของคุณไม่พร้อมใช้งาน'
                    : 'การเข้าสู่ระบบผ่าน SSO ขัดข้อง'}
                </p>
                <p className="leading-relaxed">
                  {errorParam === 'inactive'
                    ? 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน หรือไม่มีสิทธิ์เข้าใช้ระบบ กรุณาติดต่อผู้ดูแลระบบ'
                    : errorParam === 'missing_token'
                    ? 'ไม่พบข้อมูล SSO Token จากระบบต้นทาง'
                    : errorParam === 'SSO Token expired'
                    ? 'โทเค็นยืนยันตัวตน SSO หมดอายุแล้ว กรุณากลับไปกดเข้าสู่ระบบใหม่อีกครั้ง'
                    : errorParam === 'Invalid token signature'
                    ? 'ลายเซ็นดิจิทัลของ SSO ไม่ถูกต้อง กรุณาตรวจสอบ Secret Key'
                    : errorParam === 'Invalid audience'
                    ? 'โทเค็น SSO ไม่ได้รับอนุญาตสำหรับระบบนี้ (Invalid Audience)'
                    : `เกิดข้อผิดพลาดในการเชื่อมต่อ SSO: ${errorParam}`}
                </p>
              </div>
            </div>
          )}

          {/* Credential Error alert */}
          {state?.error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-2xl bg-rose-50/90 border border-rose-200 p-3.5 text-xs text-rose-900 animate-in fade-in"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <p className="leading-relaxed font-medium text-rose-950">{state.error}</p>
            </div>
          )}

          {/* Form */}
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold text-slate-700 tracking-wide block"
                htmlFor="identifier"
              >
                รหัสผู้ใช้ (ID) หรือ อีเมล
              </label>
              <input
                id="identifier"
                name="id"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                placeholder="name@example.com หรือ ID"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200/90 bg-white/70 backdrop-blur-xs text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/15 transition-all shadow-2xs hover:border-slate-300"
                required
                aria-required="true"
              />
            </div>

            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold text-slate-700 tracking-wide block"
                htmlFor="password"
              >
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-slate-200/90 bg-white/70 backdrop-blur-xs text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-3 focus:ring-blue-500/15 transition-all shadow-2xs hover:border-slate-300"
                  required
                  aria-required="true"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-r-xl transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full h-11 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:via-indigo-700 hover:to-blue-800 active:brightness-95 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer mt-3"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>กำลังเข้าสู่ระบบ...</span>
                </>
              ) : (
                <>
                  <span>เข้าสู่ระบบ</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-[400px] flex items-center justify-between text-[11px] text-slate-700 font-medium">
        <span>© 2026 CAMMS Portal. สงวนลิขสิทธิ์ทั้งหมด</span>
        <span className="hidden">ระบบความปลอดภัยพร้อมใช้งาน (256-bit Encrypted Session)</span>
        <span className="font-mono text-slate-600">v1.0.0</span>
      </footer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 text-slate-900">
          <div className="text-sm font-semibold text-slate-600 animate-pulse flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600 animate-spin" />
            <span>กำลังโหลด...</span>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}

