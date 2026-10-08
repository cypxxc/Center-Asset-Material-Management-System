import React from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { getDashboardLayoutData } from '@/features/items/queries'
import { NewItemDialogProvider } from '@/features/items/components/new-item-dialog-provider'
import { ToastProvider } from '@/components/ui/toast'

export const instant = false

const PUBLIC_ITEM_PATTERN = /^\/items\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const profilePromise = getCurrentProfile()
  let pathname = ''
  try {
    const headerList = await headers()
    pathname = headerList.get('x-pathname') || ''
  } catch {
    // headers() called outside request context (e.g. in isolated unit tests)
  }
  const isPublicItem = PUBLIC_ITEM_PATTERN.test(pathname)

  if (isPublicItem) {
    const profile = await profilePromise
    if (!profile) {
      return <>{children}</>
    }
  }

  const [profile, layoutData] = await Promise.all([
    profilePromise,
    getDashboardLayoutData(),
  ])

  if (!profile) {
    redirect('/login')
  }

  if (!profile.is_active) {
    redirect('/login?error=inactive')
  }

  const { sidebarData, references } = layoutData

  return (
    <ToastProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
      >
        ข้ามไปเนื้อหาหลัก
      </a>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <NewItemDialogProvider
          categories={references.categories}
          locations={references.locations}
          units={references.units}
        >
          <Sidebar profile={profile} sidebarData={sidebarData} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header profile={profile} />
            <main id="main-content" className="flex-1 overflow-hidden">
              {children}
            </main>
          </div>
        </NewItemDialogProvider>
      </div>
    </ToastProvider>
  )
}
