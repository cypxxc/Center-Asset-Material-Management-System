'use client'

import { Suspense, useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import {
  Package,
  AlertCircle,
  User,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const [state, formAction, isPending] = useActionState(login, null)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-12 bg-[#1A1D26] text-white relative overflow-hidden selection:bg-sky-500 selection:text-white">
      {/* Left Form Panel */}
      <div className="lg:col-span-6 xl:col-span-5 bg-[#1E222D] p-8 sm:p-12 lg:p-14 flex flex-col justify-between relative z-20 shadow-2xl min-h-screen">
        {/* Brand Bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-700/80 shadow-md">
            <Package className="h-5 w-5 text-white" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-sky-500 ring-2 ring-[#1E222D]" />
          </div>
          <div className="space-y-0.5">
            <div className="text-xl font-bold tracking-tight text-white leading-none">
              CAMMS
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Center Asset Material Management System
            </p>
          </div>
        </div>

        {/* Main Form Center Module */}
        <div className="my-auto py-8 space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block">
              ยินดีต้อนรับเข้าสู่ระบบ • OFFICIAL PORTAL
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              เข้าสู่ระบบจัดการพัสดุและครุภัณฑ์
              <span className="text-sky-400 ml-1">.</span>
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-1">
              กรอกข้อมูลบัญชีเพื่อเข้าใช้งานระบบ
            </p>
          </div>

          {/* Inactive account alert banner */}
          {errorParam === 'inactive' && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 p-3.5 text-xs text-rose-300 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-semibold">บัญชีของคุณไม่พร้อมใช้งาน</p>
                <p className="opacity-90 mt-0.5">
                  บัญชีผู้ใช้นี้ถูกระงับการใช้งาน หรือไม่มีสิทธิ์เข้าใช้ระบบ กรุณาติดต่อผู้ดูแลระบบ
                </p>
              </div>
            </div>
          )}

          {/* Credential error alert banner */}
          {state?.error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 p-3.5 text-xs text-rose-300 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <p className="leading-relaxed font-medium">{state.error}</p>
            </div>
          )}

          {/* Form Inputs */}
          <form action={formAction} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <label
                className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block"
                htmlFor="identifier"
              >
                รหัสผู้ใช้ (ID) หรือ อีเมล
              </label>
              <div className="relative">
                <input
                  id="identifier"
                  name="id"
                  type="text"
                  placeholder="กรอก ID หรือ อีเมล หรือ ชื่อผู้ใช้"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-700/80 bg-[#2A2E3B] text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all shadow-xs"
                  required
                />
                <span className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block"
                htmlFor="password"
              >
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-700/80 bg-[#2A2E3B] text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all shadow-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 active:scale-[0.99] text-white font-semibold text-sm rounded-full h-11 shadow-lg shadow-sky-500/25 transition-all w-full mt-2 cursor-pointer"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>กำลังเข้าสู่ระบบ...</span>
                </span>
              ) : (
                'เข้าสู่ระบบ'
              )}
            </Button>
          </form>
        </div>

        {/* Footer / Status */}
        <div className="space-y-3 pt-6 border-t border-slate-700/50">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
            <span>ระบบความปลอดภัยพร้อมใช้งาน (256-bit Encrypted Session)</span>
          </div>
          <p className="text-[11px] text-slate-400">
            © 2026 CAMMS. สงวนลิขสิทธิ์ทั้งหมด
          </p>
        </div>

        {/* Organic Wave Divider (SVG between Left and Right panel on desktop) */}
        <svg
          className="absolute top-0 -right-[40px] h-full w-[42px] hidden lg:block z-30 pointer-events-none"
          viewBox="0 0 42 1000"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,0 L15,0 C35,200 -10,380 28,600 C50,750 10,900 20,1000 L0,1000 Z"
            fill="#1E222D"
          />
          <path
            d="M15,0 C35,200 -10,380 28,600 C50,750 10,900 20,1000"
            stroke="rgba(56, 189, 248, 0.35)"
            strokeDasharray="5 7"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>

      {/* Right Atmospheric Panel */}
      <div className="lg:col-span-6 xl:col-span-7 relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-[#131720]">
        {/* Background depth layers */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#131720] to-[#0D1017]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(56,189,248,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(19,23,32,0.8)_80%,#131720_100%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:32px_32px] opacity-30 pointer-events-none" />

        {/* Top header badge */}
        <div className="relative z-10 flex justify-end">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-xs text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
            <span>Enterprise Asset Core</span>
          </div>
        </div>

        {/* Center ambient branding */}
        <div className="relative z-10 max-w-md my-auto space-y-4">
          <div className="inline-block px-2.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-semibold tracking-wide uppercase">
            Asset Management Platform
          </div>
          <h2 className="text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight">
            ศูนย์กลางระบบบริหารจัดการ พัสดุและครุภัณฑ์แบบครบวงจร
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            บันทึก ตรวจสอบ ติดตาม และควบคุมสินทรัพย์องค์กรอย่างแม่นยำ พร้อมระบบความปลอดภัยและการตรวจสอบตามมาตรฐานระดับองค์กร
          </p>
        </div>

        {/* Bottom-Right Watermark Seal */}
        <div className="relative z-10 flex items-center justify-between pt-6 border-t border-white/5">
          <div className="text-xs text-slate-400">
            Official Internal Portal
          </div>
          <div className="text-xs text-white/40 tracking-wider font-mono">
            CAMMS • v1.0.0
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#1A1D26] p-4 text-white">
          <div className="text-sm font-semibold text-slate-300 animate-pulse flex items-center gap-2">
            <Package className="h-5 w-5 text-sky-400 animate-spin" />
            <span>กำลังโหลด...</span>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
