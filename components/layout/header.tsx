'use client'

import React from 'react'
import Link from 'next/link'
import { HelpCircle, Home, Search, UserCog } from 'lucide-react'

interface HeaderProps {
  title?: string
  profile?: {
    full_name: string
    role: string
  } | null
}

export function Header({ title = 'CAMMS', profile }: HeaderProps) {
  const initials = profile?.full_name?.trim()?.charAt(0)?.toUpperCase() || 'R'

  return (
    <header className="relative z-20 flex h-[52px] w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/dashboard"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-slate-50 px-2.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-200 hover:bg-slate-100"
        >
          <Home className="h-3.5 w-3.5 text-blue-600" />
          <span className="hidden sm:inline">หน้าหลัก</span>
        </Link>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <h1 className="truncate text-sm font-extrabold tracking-tight text-slate-800">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">

        <Link
          href="/profile"
          className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:inline-flex"
          title="การตั้งค่าบัญชีส่วนบุคคล"
        >
          <UserCog className="h-4 w-4" />
        </Link>

        <button
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          title="คู่มือการใช้งาน"
          type="button"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        <Link
          href="/profile"
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-gradient-to-br from-blue-600 to-indigo-500 text-xs font-bold text-white shadow-sm hover:scale-105 active:scale-95 transition-transform"
          title="การตั้งค่าบัญชีส่วนบุคคล"
        >
          {initials}
        </Link>
      </div>
    </header>
  )
}
