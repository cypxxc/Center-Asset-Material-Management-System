import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { ProfileForm } from '@/features/auth/components/profile-form'
import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'

export default async function ProfilePage() {
  const profile = await getCurrentProfile()
  if (!profile) {
    redirect('/login')
  }

  return (
    <PageContainer>
      <PageHeader
        title="ตั้งค่าบัญชีส่วนบุคคล"
        subtitle="จัดการข้อมูลชื่อ-นามสกุล บัญชีผู้ใช้งาน และเปลี่ยนรหัสผ่านเพื่อความปลอดภัยในการใช้งานระบบ"
      />
      <ProfileForm profile={profile} />
    </PageContainer>
  )
}
