import { redirect, notFound } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite } from '@/lib/permissions'
import { getDisbursementById } from '@/features/disbursements/queries'
import { DisbursementDetailClient } from '@/features/disbursements/components/disbursement-detail-client'
import { PageContainer } from '@/components/ui/page-container'

export const instant = false

interface DetailPageProps {
  params: Promise<{ id: string }>
}

export default async function DisbursementDetailPage({ params }: DetailPageProps) {
  const profile = await getCurrentProfile()
  if (!profile?.is_active) {
    redirect('/login')
  }

  const { id } = await params
  const doc = await getDisbursementById(id)
  if (!doc) notFound()

  return (
    <PageContainer maxWidth="7xl" contentClassName="max-w-5xl mx-auto">
      <DisbursementDetailClient doc={doc} canMutate={canWrite(profile.role)} />
    </PageContainer>
  )
}
