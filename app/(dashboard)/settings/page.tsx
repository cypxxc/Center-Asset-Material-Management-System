import {
  CategorySection,
  LocationSection,
  UnitSection,
  ProfileSection,
  ImportSection,
} from '@/features/settings/components/metadata-sections'
import { getSettingsData, getAllProfiles } from '@/features/settings/queries'
import { canManageSettings } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { Tag, Building2, Box, Users, Upload } from 'lucide-react'
import Link from 'next/link'

import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'

interface SettingsPageProps {
  searchParams: Promise<{
    message?: string
    error?: string
    tab?: string
  }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const currentProfile = await getCurrentProfile()
  if (!canManageSettings(currentProfile?.role)) {
    redirect('/dashboard')
  }
  const isAdmin = currentProfile?.role === 'admin'

  const [params, data, profiles] = await Promise.all([
    searchParams,
    getSettingsData(),
    isAdmin ? getAllProfiles() : Promise.resolve([]),
  ])

  const activeTab = params.tab || 'categories'

  const tabs = [
    { id: 'categories', label: 'หมวดหมู่พัสดุ', icon: <Tag className="h-4 w-4" /> },
    { id: 'locations', label: 'สถานที่จัดตั้ง', icon: <Building2 className="h-4 w-4" /> },
    { id: 'units', label: 'หน่วยนับ', icon: <Box className="h-4 w-4" /> },
    { id: 'import', label: 'นำเข้าพัสดุ CSV/Excel', icon: <Upload className="h-4 w-4" /> },
    ...(isAdmin ? [
      { id: 'users', label: 'ผู้ใช้งานระบบ', icon: <Users className="h-4 w-4" /> }
    ] : []),
  ]

  return (
    <PageContainer>
      <PageHeader
        title="ตั้งค่าระบบและมิติตัวเลือกพัสดุ"
        subtitle="จัดการข้อมูลพื้นฐานที่ใช้ในการขึ้นทะเบียน ทรัพย์สินที่ใช้งานจริงอยู่จะได้รับการคุ้มครองสิทธิ์ไม่ให้ถูกลบโดยไม่ตั้งใจ"
      />

      {params.message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 animate-in fade-in duration-200">
          {params.message}
        </div>
      )}

        {params.error && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                  <span className="material-symbols-outlined text-[28px]">error</span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-950">เกิดข้อผิดพลาดในการตั้งค่า</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{params.error}</p>
                </div>
                <Link
                  href={`/settings?tab=${activeTab}`}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center"
                >
                  ตกลง (เข้าใจแล้ว)
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Tabbed Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <Link
                key={tab.id}
                href={`/settings?tab=${tab.id}`}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? 'border-blue-600 text-blue-600 bg-white/50 rounded-t-xl'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Tab Contents */}
        <div className="mt-4 animate-in fade-in duration-200">
          {activeTab === 'categories' && (
            <CategorySection categories={data.categories} />
          )}
          {activeTab === 'locations' && (
            <LocationSection locations={data.locations} />
          )}
          {activeTab === 'units' && (
            <UnitSection units={data.units} />
          )}
          {activeTab === 'users' && isAdmin && (
            <ProfileSection profiles={profiles} />
          )}
          {activeTab === 'import' && (
            <ImportSection />
          )}
        </div>
    </PageContainer>
  )
}

