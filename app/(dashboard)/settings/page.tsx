import {
  CategorySection,
  LocationSection,
  UnitSection,
  ImportSection,
} from '@/features/settings/components/metadata-sections'
import { getSettingsPageData } from '@/features/settings/queries'
import { canManageSettings } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { Tag, Building2, Box, Upload, AlertCircle } from 'lucide-react'
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

export const metadata = { title: 'ตั้งค่าระบบ' }

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const [currentProfile, params] = await Promise.all([
    getCurrentProfile(),
    searchParams,
  ])

  if (!canManageSettings(currentProfile?.role)) {
    redirect('/dashboard')
  }

  const { activeTab, data } = await getSettingsPageData(params.tab)

  const tabs = [
    { id: 'categories', label: 'หมวดหมู่พัสดุ', icon: <Tag className="h-4 w-4" /> },
    { id: 'locations', label: 'สถานที่จัดตั้ง', icon: <Building2 className="h-4 w-4" /> },
    { id: 'units', label: 'หน่วยนับ', icon: <Box className="h-4 w-4" /> },
    { id: 'import', label: 'นำเข้าพัสดุ CSV/Excel', icon: <Upload className="h-4 w-4" /> },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="ตั้งค่าระบบและมิติตัวเลือกพัสดุ"
        subtitle="จัดการข้อมูลพื้นฐานที่ใช้ในการขึ้นทะเบียน ทรัพย์สินที่ใช้งานจริงอยู่จะได้รับการคุ้มครองสิทธิ์ไม่ให้ถูกลบโดยไม่ตั้งใจ"
      />

      {params.message && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
          {params.message}
        </div>
      )}

      {params.error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="size-4 shrink-0 text-destructive" />
            <span>{params.error}</span>
          </div>
          <Link
            href={`/settings?tab=${activeTab}`}
            className="shrink-0 px-2.5 py-1 rounded-md bg-destructive/15 hover:bg-destructive/25 text-destructive font-bold transition-colors"
          >
            ปิด
          </Link>
        </div>
      )}

      {/* Tabbed Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-px">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <Link
              key={tab.id}
              href={`/settings?tab=${tab.id}`}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-primary text-primary font-bold bg-primary/5 rounded-t-lg'
                  : 'border-transparent text-muted-foreground hover:text-card-foreground hover:bg-muted/40 font-semibold rounded-t-lg'
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
        {activeTab === 'import' && (
          <ImportSection />
        )}
      </div>
    </PageContainer>
  )
}
