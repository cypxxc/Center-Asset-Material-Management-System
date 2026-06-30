import React from 'react'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { getSidebarData } from '@/features/items/queries'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const profile = await getCurrentProfile()

  if (!profile) {
    redirect('/login')
  }

  const sidebarData = await getSidebarData()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f0f4f8] text-slate-900">
      <Sidebar profile={profile} sidebarData={sidebarData} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header profile={profile} />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
