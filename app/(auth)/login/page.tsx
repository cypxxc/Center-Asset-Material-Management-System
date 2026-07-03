'use client'

import { Suspense, useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login } from '@/features/auth/actions'
import { Button } from '@/components/ui/button'
import { Package, Lock, AlertCircle, User, Eye, EyeOff } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const [state, formAction, isPending] = useActionState(login, null)

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)


  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4 sm:p-6 relative overflow-hidden">
      {/* Background Subtle Mesh Decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_100%,transparent_100%)] opacity-70 pointer-events-none"></div>
      
      {/* Background Soft Glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-[420px] bg-white border border-slate-200/80 rounded-2xl p-8 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.06)] flex flex-col gap-6">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md shadow-slate-900/10">
            <Package className="h-6 w-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">CAMMS</h1>
            <p className="text-xs text-slate-500">Center Asset Material Management System</p>
          </div>
        </div>

        {/* Error Handling */}
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

        {state?.error && (
          <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-100 p-3.5 text-xs text-rose-700 animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
            <p className="leading-relaxed font-medium">{state.error}</p>
          </div>
        )}

        {/* Login Form */}
        <form action={formAction} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider" htmlFor="identifier">
              รหัสผู้ใช้ (ID)
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
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950/10 focus:border-slate-950 focus:bg-white transition-all shadow-sm"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider" htmlFor="password">
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
                className="w-full h-10 pl-10 pr-10 rounded-xl border border-slate-200 bg-slate-50/50 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-950/10 focus:border-slate-950 focus:bg-white transition-all shadow-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={isPending} className="w-full h-10 font-semibold shadow-md shadow-slate-950/5 rounded-xl mt-1.5 transition-all hover:bg-slate-900 active:scale-[0.99] cursor-pointer">
            {isPending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </Button>
        </form>


        {/* Footer copyright */}
        <div className="text-center">
          <p className="text-[10px] text-slate-400">
            © {new Date().getFullYear()} Registry-S. สงวนลิขสิทธิ์ทั้งหมด
          </p>
        </div>
      </div>
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
