import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { ChangePasswordForm } from '@/features/auth/components/change-password-form'
import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'
import { AccountEmailForm } from '@/features/auth/components/account-email-form'
import { isInternalEmail } from '@/lib/display-email'

export const metadata = { title: 'บัญชีผู้ใช้' }

export default async function ProfilePage() {
  const profile = await getCurrentProfile()
  if (!profile) {
    redirect('/login')
  }

  return (
    <PageContainer>
      <PageHeader
        title="บัญชีผู้ใช้"
      />
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div className="rounded-xl border border-border bg-card p-6 space-y-2">
          <h2 className="text-base font-semibold">{profile.display_name?.trim() || profile.full_name}</h2>
          <p className="text-xs text-muted-foreground">ชื่อเข้าสู่ระบบ: {profile.full_name}</p>
          {profile.email && !isInternalEmail(profile.email) && <p className="break-all text-sm text-muted-foreground">อีเมล: {profile.email}</p>}
        </div>
        {(!profile.email || isInternalEmail(profile.email)) && <AccountEmailForm />}
        <ChangePasswordForm />
      </div>
    </PageContainer>
  )
}
