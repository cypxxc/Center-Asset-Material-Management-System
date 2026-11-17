import { redirect, notFound } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { isAdmin } from '@/lib/permissions'
import { getDisbursementById } from '@/features/disbursements/queries'
import { DisbursementDetailClient } from '@/features/disbursements/components/disbursement-detail-client'
import { PageContainer } from '@/components/ui/page-container'
import { parseMaterialApprovalSlaHours } from '@/features/disbursements/tracking'

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

  if (doc.status === 'rejected') {
    redirect(isAdmin(profile.role) ? '/disbursements?tab=requests' : '/disbursements?tab=documents')
  }

  if (isAdmin(profile.role) && (doc.status === 'pending_approval' || doc.status === 'draft')) {
    redirect('/disbursements?tab=requests')
  }

  return (
    <PageContainer maxWidth="7xl" contentClassName="max-w-5xl mx-auto">
      <DisbursementDetailClient materialApprovalSlaHours={parseMaterialApprovalSlaHours(process.env.MATERIAL_APPROVAL_SLA_HOURS)} doc={doc} canMutate={isAdmin(profile.role)} canRequest={profile.role === 'user'} canWithdraw={profile.role === 'user' && doc.created_by === profile.id && doc.status === 'pending_approval'} />
    </PageContainer>
  )
}
