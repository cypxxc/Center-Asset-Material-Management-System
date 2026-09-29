import React from 'react'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/features/admin/actions'

export const dynamic = 'force-dynamic'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const auth = await requireAdmin()
  if (auth.error || !auth.profile) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
