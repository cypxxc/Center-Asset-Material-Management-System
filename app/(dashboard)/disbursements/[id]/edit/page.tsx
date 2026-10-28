import { redirect, notFound } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite } from '@/lib/permissions'
import { getDisbursementById, getDisbursementSelectableItems } from '@/features/disbursements/queries'
import { DisbursementDraftFormClient } from '@/features/disbursements/components/disbursement-draft-form-client'
import { PageContainer } from '@/components/ui/page-container'

export const instant = false

interface EditPageProps {
  params: Promise<{ id: string }>
}

export default async function EditDisbursementPage({ params }: EditPageProps) {
  const profile = await getCurrentProfile()
  if (!profile?.is_active) {
    redirect('/login')
  }
  if (!canWrite(profile.role)) {
    redirect('/disbursements')
  }

  const { id } = await params
  const doc = await getDisbursementById(id)
  if (!doc) notFound()

  // Only drafts can be edited
  if (doc.status !== 'draft') {
    redirect(`/disbursements/${id}`)
  }

  const availableItems = await getDisbursementSelectableItems()

  return (
    <PageContainer maxWidth="7xl" contentClassName="max-w-5xl mx-auto">
      <DisbursementDraftFormClient initialDoc={doc} availableItems={availableItems} />
    </PageContainer>
  )
}

