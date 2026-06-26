import {
  CategorySection,
  LocationSection,
  UnitSection,
  ProfileSection,
} from '@/features/settings/components/metadata-sections'
import { getSettingsData, getAllProfiles } from '@/features/settings/queries'
import { getCurrentProfile } from '@/features/auth/queries'

interface SettingsPageProps {
  searchParams: Promise<{
    message?: string
    error?: string
  }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const currentProfile = await getCurrentProfile()
  const isAdmin = currentProfile?.role === 'admin'

  const [params, data, profiles] = await Promise.all([
    searchParams,
    getSettingsData(),
    isAdmin ? getAllProfiles() : Promise.resolve([]),
  ])

  return (
    <div className="h-full overflow-y-auto bg-[#f0f4f8] p-6 md:p-8">

      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">ตั้งค่าระบบและมิติตัวเลือกพัสดุ</h2>
          <p className="text-xs text-slate-500 mt-1">
            จัดการข้อมูลพื้นฐานที่ใช้ในการขึ้นทะเบียน ทรัพย์สินที่ใช้งานจริงอยู่จะได้รับการคุ้มครองสิทธิ์ไม่ให้ถูกลบโดยไม่ตั้งใจ
          </p>
        </div>


        {params.message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {params.message}
          </div>
        )}

        {params.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {params.error}
          </div>
        )}

        <CategorySection categories={data.categories} />
        <LocationSection locations={data.locations} />
        <UnitSection units={data.units} />

        {isAdmin && <ProfileSection profiles={profiles} />}
      </div>
    </div>
  )
}

