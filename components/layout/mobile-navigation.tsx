'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Dialog } from 'radix-ui'
import { Menu, X, Home, Package, Settings, UserCog, History, Database, LogOut, MapPin, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/features/auth/actions'

export function MobileNavigation({ profile }: { profile?: { full_name: string; role: string } | null }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const initials = profile?.full_name?.trim()?.charAt(0)?.toUpperCase() || 'U'
  return <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Trigger asChild><button
          aria-label="เปิดเมนูนำทาง"
          className="flex md:hidden mr-1 rounded-lg p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground cursor-pointer shrink-0"
          title="เมนูนำทาง"
          type="button"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button></Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 flex w-[min(320px,90vw)] flex-col bg-card text-foreground shadow-xl">
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <Dialog.Title className="text-base font-semibold">เมนูนำทาง</Dialog.Title>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="ปิดเมนูนำทาง"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground cursor-pointer"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Links */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 text-foreground text-sm font-semibold">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  pathname === '/dashboard' ? "bg-blue-50 text-blue-700" : "hover:bg-muted"
                )}
              >
                <Home className="h-4 w-4 text-blue-600" />
                <span>แผงควบคุม (Dashboard)</span>
              </Link>

              <Link
                href="/items"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  pathname === '/items' && !searchParams.get('type') && !searchParams.get('deleted') ? "bg-blue-50 text-blue-700" : "hover:bg-muted"
                )}
              >
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>พัสดุทั้งหมด (All Items)</span>
              </Link>

              <Link
                href="/items?type=asset"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  pathname === '/items' && searchParams.get('type') === 'asset' ? "bg-blue-50 text-blue-700" : "hover:bg-muted"
                )}
              >
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>ทะเบียนครุภัณฑ์ (Assets)</span>
              </Link>

              <Link
                href="/items?type=material"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  pathname === '/items' && searchParams.get('type') === 'material' ? "bg-blue-50 text-blue-700" : "hover:bg-muted"
                )}
              >
                <Package className="h-4 w-4 text-muted-foreground" />
                <span>วัสดุ</span>
              </Link>

              {[{ href: '/locations', label: 'สถานที่จัดเก็บ', Icon: MapPin }, { href: '/reports', label: 'รายงานพัสดุ', Icon: FileText }].map(({ href, label, Icon }) => (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)} aria-current={pathname === href ? 'page' : undefined} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5', pathname === href ? 'bg-primary/10 text-primary' : 'hover:bg-muted')}><Icon className="size-4" />{label}</Link>
              ))}
              {(profile?.role === 'admin' || profile?.role === 'staff') && <Link
                href="/settings"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  pathname === '/settings' ? "bg-blue-50 text-blue-700" : "hover:bg-muted"
                )}
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>ตั้งค่าระบบ (Settings)</span>
              </Link>}

              {profile?.role === 'admin' && (
                <>
                  <Link
                    href="/admin/users"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      pathname.startsWith('/admin/users') ? "bg-blue-50 text-blue-700" : "hover:bg-muted"
                    )}
                  >
                    <UserCog className="h-4 w-4 text-muted-foreground" />
                    <span>จัดการผู้ใช้งาน (Users)</span>
                  </Link>

                  <Link
                    href="/admin/audit-logs"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      pathname.startsWith('/admin/audit-logs') ? "bg-blue-50 text-blue-700" : "hover:bg-muted"
                    )}
                  >
                    <History className="h-4 w-4 text-muted-foreground" />
                    <span>ประวัติการทำรายการ (Audit Logs)</span>
                  </Link>

                  <Link
                    href="/admin/db-panel"
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      pathname.startsWith('/admin/db-panel') ? "bg-blue-50 text-blue-700" : "hover:bg-muted"
                    )}
                  >
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span>จัดการฐานข้อมูล (DB Panel)</span>
                  </Link>
                </>
              )}
            </nav>

            {/* Footer containing profile & signout */}
            <div className="border-t border-border p-4 bg-muted">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-xs font-bold text-foreground">{profile?.full_name}</div>
                  <div className="truncate text-xs font-semibold text-muted-foreground uppercase tracking-wider">{profile?.role}</div>
                </div>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              </form>
            </div>
          </Dialog.Content>
      </Dialog.Portal>
  </Dialog.Root>
}
