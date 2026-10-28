import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite } from '@/lib/permissions'
import { getDisbursementSelectableItems } from '@/features/disbursements/queries'
import { DisbursementDraftFormClient } from '@/features/disbursements/components/disbursement-draft-form-client'
import { PageContainer } from '@/components/ui/page-container'
import type { DisbursementTransactionType } from '@/features/disbursements/types'

export const instant = false

interface NewDisbursementPageProps {
  searchParams?: Promise<{ items?: string; type?: string }>
}

export default async function NewDisbursementPage({ searchParams }: NewDisbursementPageProps) {
  const profile = await getCurrentProfile()
  if (!profile?.is_active) {
    redirect('/login')
  }
  if (!canWrite(profile.role)) {
    redirect('/disbursements')
  }

  const resolvedParams = searchParams ? await searchParams : {}
  const preselectedItemIds = resolvedParams.items
    ? resolvedParams.items.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const initialType = (['material_issue', 'asset_handover', 'asset_borrow'].includes(resolvedParams.type ?? '')
    ? resolvedParams.type
    : undefined) as DisbursementTransactionType | undefined

  // Fetch all selectable items for disbursement
  const availableItems = await getDisbursementSelectableItems()

  return (
    <PageContainer maxWidth="7xl" contentClassName="max-w-5xl mx-auto">
      <DisbursementDraftFormClient
        availableItems={availableItems}
        initialItemIds={preselectedItemIds}
        initialType={initialType}
      />
    </PageContainer>
  )
}


