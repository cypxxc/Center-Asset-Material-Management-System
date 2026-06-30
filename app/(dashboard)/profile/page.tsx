import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { ProfileForm } from '@/features/auth/components/profile-form'

export default async function ProfilePage() {
  const profile = await getCurrentProfile()
  if (!profile) {
    redirect('/login')
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f0f4f8] p-6 md:p-8">
      <ProfileForm profile={profile} />
    </div>
  )
}
