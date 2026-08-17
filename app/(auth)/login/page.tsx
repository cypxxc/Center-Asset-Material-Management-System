'use client'

import { Suspense, useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import {
  Package,
  Lock,
  AlertCircle,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  Tag,
  Printer,
  Sparkles,
  HelpCircle,
} from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const [state, formAction, isPending] = useActionState(login, null)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-12 bg-slate-50 selection:bg-slate-900 selection:text-white">
      {/* Left Panel: Enterprise Branding & Operational Status */}
      <section className="lg:col-span-5 xl:col-span-4 bg-slate-950 text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden shadow-2xl z-10">
        {/* Ambient background decoration */}
        <div className="absolute -right-24 -top-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-slate-800/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        {/* Top: Branding Header */}
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/80 shadow-md">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white block">
                CAMMS
              </span>
              <span className="text-[11px] font-medium text-slate-400 block tracking-wide">
                Center Asset Material Management System
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800/80 border border-slate-700/60 text-slate-300">
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>ระบบส่วนกลาง Enterprise Portal</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              ระบบทะเบียนสิ่งของและครุภัณฑ์สำนักงานสำหรับการจัดเก็บ ตรวจสอบ และบริหารจัดการพัสดุอย่างเป็นระเบียบ
            </p>
          </div>

          {/* Highlights Cards */}
          <div className="mt-4 space-y-2.5">
            <div className="flex items-start gap-3 rounded-xl bg-slate-900/80 border border-slate-800/90 p-3.5 backdrop-blur-xs">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                <Tag className="h-3.5 w-3.5" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-200">
                  🏷️ ทะเบียนครุภัณฑ์และวัสดุสำนักงานครบวงจร
                </p>
                <p className="text-slate-400 mt-0.5 leading-normal text-[11px]">
                  ติดตามสถานะ ตำแหน่งที่ตั้ง หมวดหมู่ และหน่วยนับอย่างแม่นยำ
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-slate-900/80 border border-slate-800/90 p-3.5 backdrop-blur-xs">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-200">
                  🔐 ควบคุมสิทธิ์การเข้าถึงตามระดับบทบาท (RBAC)
                </p>
                <p className="text-slate-400 mt-0.5 leading-normal text-[11px]">
                  การบริหารจัดการสิทธิ์แบบรัดกุมพร้อมบันทึก Audit Logs ตรวจสอบย้อนหลัง
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-slate-900/80 border border-slate-800/90 p-3.5 backdrop-blur-xs">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60">
                <Printer className="h-3.5 w-3.5" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-200">
                  🖨️ พิมพ์ป้ายสติกเกอร์รหัสทรัพย์สินและ QR Code
                </p>
                <p className="text-slate-400 mt-0.5 leading-normal text-[11px]">
                  รองรับป้ายติดทรัพย์สินทั้งแบบมาตรฐานและด่วนพร้อมรหัสกำกับ
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Live System Status & Security Badge */}
        <div className="relative z-10 mt-8 pt-6 border-t border-slate-800/80 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/50 text-[11px] font-medium text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>สถานะระบบ: พร้อมใช้งานปกติ</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-normal">
            ระบบความปลอดภัยสำหรับบุคลากรภายในหน่วยงานเท่านั้น การเข้าใช้งานทั้งหมดถูกบันทึกเพื่อความปลอดภัย
          </p>
        </div>
      </section>

      {/* Right Panel: Clean Authentication Workspace */}
      <main className="lg:col-span-7 xl:col-span-8 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-[440px] bg-white border border-slate-200/90 rounded-2xl p-8 sm:p-10 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.06)] flex flex-col gap-6">
          {/* Header Greeting */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              เข้าสู่ระบบ
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              กรอกข้อมูลบัญชีเพื่อเข้าใช้งานระบบ CAMMS
            </p>
          </div>

          {/* Error Banner: Inactive Account */}
          {errorParam === 'inactive' && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-100 p-3.5 text-xs text-rose-700 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-semibold">บัญชีของคุณไม่พร้อมใช้งาน</p>
                <p className="opacity-90 mt-0.5">
                  บัญชีผู้ใช้นี้ถูกระงับการใช้งาน หรือไม่มีสิทธิ์เข้าใช้ระบบ กรุณาติดต่อผู้ดูแลระบบ
                </p>
              </div>
            </div>
          )}

          {/* Error Banner: Form / Credential Error */}
          {state?.error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-100 p-3.5 text-xs text-rose-700 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <p className="leading-relaxed font-medium">{state.error}</p>
            </div>
          )}

          {/* Login Form */}
          <form action={formAction} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <label
                className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block"
                htmlFor="identifier"
              >
                รหัสผู้ใช้ (ID) หรือ อีเมล
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <User className="h-4 w-4 text-slate-400" />
                </span>
                <input
                  id="identifier"
                  name="id"
                  type="text"
                  placeholder="กรอก ID (UUID) หรือ อีเมล หรือ ชื่อ-นามสกุล"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950/10 focus:border-slate-950 focus:bg-white transition-all shadow-xs"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block"
                htmlFor="password"
              >
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-11 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950/10 focus:border-slate-950 focus:bg-white transition-all shadow-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isPending}
              className="w-full h-11 font-semibold text-sm shadow-md shadow-slate-950/5 rounded-xl mt-2 transition-all hover:bg-slate-900 active:scale-[0.99] cursor-pointer"
            >
              {isPending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </Button>
          </form>

          {/* Help & Support Notice */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-center gap-2 text-xs text-slate-500">
            <HelpCircle className="h-4 w-4 shrink-0 text-slate-400" />
            <span>ต้องการความช่วยเหลือหรือลืมรหัสผ่าน? กรุณาติดต่อผู้ดูแลระบบ</span>
          </div>

          {/* Footer copyright */}
          <div className="text-center pt-2">
            <p className="text-[11px] text-slate-400">
              © {new Date().getFullYear()} CAMMS Registry-S. สงวนลิขสิทธิ์ทั้งหมด
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-600 animate-pulse flex items-center gap-2">
            <Package className="h-5 w-5 text-primary animate-spin" />
            <span>กำลังโหลด...</span>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
