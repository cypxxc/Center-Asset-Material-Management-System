'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Dialog } from 'radix-ui'
import { Menu, X, LayoutDashboard, Layers, Package, Boxes, Settings, UserCog, History, Database, LogOut, MapPin, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/features/auth/actions'
import { ThemeToggle } from '@/components/theme-toggle'
import { ROLE_LABELS } from './nav-config'

export function MobileNavigation({ profile }: { profile?: { full_name: string; display_name?: string | null; role: string } | null }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)
  const effectiveDisplayName = profile?.display_name?.trim() || profile?.full_name
  const initials = effectiveDisplayName?.trim()?.charAt(0)?.toUpperCase() || 'U'

  const isDashboardActive = pathname === '/dashboard'
  const isItemsActive = pathname === '/items' && !searchParams.get('type') && !searchParams.get('deleted')
  const isAssetsActive = pathname === '/items' && searchParams.get('type') === 'asset'
  const isSuppliesActive = pathname === '/items' && searchParams.get('type') === 'material'
  const isLocationsActive = pathname === '/locations'
  const isReportsActive = pathname === '/reports'
  const isDisbursementsActive = pathname.startsWith('/disbursements')
  const isSettingsActive = pathname === '/settings'
  const isUsersActive = pathname.startsWith('/admin/users')
  const isAuditLogsActive = pathname.startsWith('/admin/audit-logs')
  const isDbPanelActive = pathname.startsWith('/admin/db-panel')
  const isProfileActive = pathname === '/profile'

  const activeLinkClass = 'bg-primary/10 text-primary font-bold border border-primary/20'
  const inactiveLinkClass = 'hover:bg-muted text-foreground'

  return (
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <Dialog.Trigger asChild>
        <button
          aria-label="เปิดเมนูนำทาง"
          className="flex md:hidden mr-1 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer shrink-0"
          title="เมนูนำทาง"
          type="button"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-50 flex w-[min(320px,90vw)] flex-col bg-card text-foreground shadow-xl">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <Dialog.Title className="text-base font-semibold">เมนูนำทาง</Dialog.Title>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="ปิดเมนูนำทาง"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Links */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 text-sm font-semibold">
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              aria-current={isDashboardActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isDashboardActive ? activeLinkClass : inactiveLinkClass
              )}
            >
              <LayoutDashboard className="h-4 w-4 text-sky-500 shrink-0" />
              <span>แผงควบคุม (Dashboard)</span>
            </Link>

            <Link
              href="/items"
              onClick={() => setMobileOpen(false)}
              aria-current={isItemsActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isItemsActive ? activeLinkClass : inactiveLinkClass
              )}
            >
              <Layers className="h-4 w-4 text-indigo-500 shrink-0" />
              <span>พัสดุทั้งหมด (All Items)</span>
            </Link>

            <Link
              href="/items?type=asset"
              onClick={() => setMobileOpen(false)}
              aria-current={isAssetsActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isAssetsActive ? activeLinkClass : inactiveLinkClass
              )}
            >
              <Package className="h-4 w-4 text-blue-500 shrink-0" />
              <span>ทะเบียนครุภัณฑ์ (Assets)</span>
            </Link>

            <Link
              href="/items?type=material"
              onClick={() => setMobileOpen(false)}
              aria-current={isSuppliesActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isSuppliesActive ? activeLinkClass : inactiveLinkClass
              )}
            >
              <Boxes className="h-4 w-4 text-amber-500 shrink-0" />
              <span>พัสดุ</span>
            </Link>

            <Link
              href="/locations"
              onClick={() => setMobileOpen(false)}
              aria-current={isLocationsActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                isLocationsActive ? activeLinkClass : inactiveLinkClass
              )}
            >
              <MapPin className="h-4 w-4 text-rose-500 shrink-0" />
              <span>สถานที่จัดเก็บ</span>
            </Link>

            <Link
              href="/reports"
              onClick={() => setMobileOpen(false)}
              aria-current={isReportsActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                isReportsActive ? activeLinkClass : inactiveLinkClass
              )}
            >
              <BarChart3 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>รายงานพัสดุ</span>
            </Link>

            <Link
              href="/disbursements"
              onClick={() => setMobileOpen(false)}
              aria-current={isDisbursementsActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                isDisbursementsActive ? activeLinkClass : inactiveLinkClass
              )}
            >
              <Boxes className="h-4 w-4 text-amber-500 shrink-0" />
              <span>เบิก-จ่ายพัสดุ</span>
            </Link>

            {(profile?.role === 'admin' || profile?.role === 'staff') && (
              <Link
                href="/settings"
                onClick={() => setMobileOpen(false)}
                aria-current={isSettingsActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  isSettingsActive ? activeLinkClass : inactiveLinkClass
                )}
              >
                <Settings className="h-4 w-4 text-violet-500 shrink-0" />
                <span>ตั้งค่าระบบ (Settings)</span>
              </Link>
            )}

            {profile?.role === 'admin' && (
              <>
                <Link
                  href="/admin/users"
                  onClick={() => setMobileOpen(false)}
                  aria-current={isUsersActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    isUsersActive ? activeLinkClass : inactiveLinkClass
                  )}
                >
                  <UserCog className="h-4 w-4 text-purple-500 shrink-0" />
                  <span>จัดการผู้ใช้งาน (Users)</span>
                </Link>

                <Link
                  href="/admin/audit-logs"
                  onClick={() => setMobileOpen(false)}
                  aria-current={isAuditLogsActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    isAuditLogsActive ? activeLinkClass : inactiveLinkClass
                  )}
                >
                  <History className="h-4 w-4 text-orange-500 shrink-0" />
                  <span>ประวัติการทำรายการ (Audit Logs)</span>
                </Link>

                <Link
                  href="/admin/db-panel"
                  onClick={() => setMobileOpen(false)}
                  aria-current={isDbPanelActive ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    isDbPanelActive ? activeLinkClass : inactiveLinkClass
                  )}
                >
                  <Database className="h-4 w-4 text-teal-500 shrink-0" />
                  <span>จัดการฐานข้อมูล (DB Panel)</span>
                </Link>
              </>
            )}
          </nav>

          {/* Footer containing profile & signout */}
          <div className="border-t border-border p-4 bg-muted/40">
            {profile ? (
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                aria-current={isProfileActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 mb-3 p-2 rounded-lg transition-colors group border',
                  isProfileActive ? 'bg-card border-primary/20 shadow-xs' : 'border-transparent hover:bg-card/70'
                )}
                title="ตั้งค่าบัญชีส่วนบุคคล"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 leading-tight flex-1">
                  <div className="truncate text-xs font-bold text-foreground group-hover:text-primary transition-colors">{effectiveDisplayName}</div>
                  <div className="truncate text-xs font-semibold text-muted-foreground mt-0.5">
                    {ROLE_LABELS[profile.role] ?? profile.role}
                  </div>
                </div>
              </Link>
            ) : null}
            <form action={signOut}>
              <button
                type="submit"
                className="w-full bg-destructive/10 hover:bg-destructive/15 text-destructive font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>ออกจากระบบ</span>
              </button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
