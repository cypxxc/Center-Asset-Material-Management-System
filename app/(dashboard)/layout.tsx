import React from 'react'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { getItemReferences, getSidebarData } from '@/features/items/queries'
import { getAssetNumberTemplates } from '@/features/asset-numbers/queries'
import { NewItemDialogProvider } from '@/features/items/components/new-item-dialog-provider'
import { ToastProvider } from '@/components/ui/toast'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const profile = await getCurrentProfile()

  if (!profile) {
    return (
      <ToastProvider>
        <div className="min-h-screen w-screen overflow-y-auto bg-slate-50 text-slate-900">
          {children}
        </div>
      </ToastProvider>
    )
  }

  if (!profile.is_active) {
    redirect('/login?error=inactive')
  }

  const [sidebarData, references, assetNumberTemplates] = await Promise.all([
    getSidebarData(),
    getItemReferences(),
    getAssetNumberTemplates(true),
  ])

  return (
    <ToastProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg"
      >
        ข้ามไปเนื้อหาหลัก
      </a>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-slate-900">
        <NewItemDialogProvider
          categories={references.categories}
          locations={references.locations}
          units={references.units}
          assetNumberTemplates={assetNumberTemplates}
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
