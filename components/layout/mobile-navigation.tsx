'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Dialog } from 'radix-ui'
import { Menu, X, LayoutDashboard, Package, Boxes, Warehouse, ArrowLeftRight, Settings, History, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { signOut } from '@/features/auth/actions'
import { ROLE_LABELS } from './nav-config'

export function MobileNavigation({ profile }: { profile?: { full_name: string; display_name?: string | null; role: string } | null }) {
  const pathname = usePathname()
  const disbursementsLabel = profile?.role === 'user' ? 'เบิก' : 'เบิก - จ่าย'
  const [mobileOpen, setMobileOpen] = useState(false)
  const isDashboardActive = pathname === '/dashboard'
  const isCentralActive = pathname === '/central-items'
  const isInventoryActive = pathname.startsWith('/items')
  const isMaterialsActive = pathname.startsWith('/materials')

  const isDisbursementsActive = pathname.startsWith('/disbursements')
  const isSettingsActive = pathname === '/settings'
  const isAuditLogsActive = pathname.startsWith('/admin/audit-logs')
  const isProfileActive = pathname === '/profile'

  const activeLinkClass = 'bg-primary/10 text-primary font-bold border border-primary/20'
  const inactiveLinkClass = 'hover:bg-muted text-foreground'

  return (
    <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
      <Dialog.Trigger asChild>
        <button
          aria-label="เปิดเมนูนำทาง"
          className="flex md:hidden mr-1 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer shrink-0 transition-colors"
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
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg overflow-hidden shadow-2xs ring-1 ring-border/60 bg-white/95 p-0.5">
                <Image
                  src="/images/moph-r7-emblem.webp"
                  alt="โลโก้เขตสุขภาพที่ 7"
                  width={32}
                  height={32}
                  className="h-full w-full object-contain"
                />
              </div>
              <Dialog.Title className="text-base font-semibold">เมนูนำทาง</Dialog.Title>
            </div>
            <div className="flex items-center gap-2">
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
              <span>Dashboard</span>
            </Link>

            <Link
              href="/items"
              onClick={() => setMobileOpen(false)}
              aria-current={isInventoryActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isInventoryActive ? activeLinkClass : inactiveLinkClass
              )}
            >
              <Package className="h-4 w-4 text-blue-500 shrink-0" />
              <span>ครุภัณฑ์</span>
            </Link>

            <Link href="/materials" onClick={() => setMobileOpen(false)} aria-current={isMaterialsActive ? 'page' : undefined}
              className={cn('flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',isMaterialsActive ? activeLinkClass : inactiveLinkClass)}>
              <Boxes className="h-4 w-4 shrink-0" /><span>วัสดุ</span>
            </Link>

            <Link
              href="/central-items"
              onClick={() => setMobileOpen(false)}
              aria-current={isCentralActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isCentralActive ? activeLinkClass : inactiveLinkClass
              )}
            >
              <Warehouse className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="truncate">วัสดุ - ครุภัณฑ์คงคลัง</span>
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
              <ArrowLeftRight className="h-4 w-4 text-amber-500 shrink-0" />
              <span>{disbursementsLabel}</span>
            </Link>



            {profile?.role === 'admin' && (
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
              </>
            )}
          </nav>

          {/* Footer containing profile & signout */}
          <div data-footer className="border-t border-border p-4 bg-muted/40">
            {profile ? (
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                aria-current={isProfileActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 mb-3 p-2 rounded-lg transition-colors group border',
                  isProfileActive ? 'bg-card border-primary/20 shadow-xs' : 'border-transparent hover:bg-card/70'
                )}
                title="บัญชีผู้ใช้"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0 leading-tight flex-1">
                  <div className="truncate text-xs font-bold text-foreground group-hover:text-primary transition-colors">{profile.display_name?.trim() || profile.full_name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{ROLE_LABELS[profile.role] ?? profile.role}</div>
                </div>
              </Link>
            ) : null}
            <form action={signOut}>
              <button
                type="submit"
                className="w-full bg-destructive/10 hover:bg-destructive/15 text-destructive font-medium text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>ออกจากระบบ</span>
              </button>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
