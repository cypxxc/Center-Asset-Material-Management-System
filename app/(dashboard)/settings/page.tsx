import {
  CategorySection,
  LocationSection,
  UnitSection,
  ImportSection,
} from '@/features/settings/components/metadata-sections'
import { getSettingsData } from '@/features/settings/queries'
import { canManageSettings } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { Tag, Building2, Box, Upload } from 'lucide-react'
import { Hash } from 'lucide-react'
import Link from 'next/link'

import { PageContainer } from '@/components/ui/page-container'
import { PageHeader } from '@/components/ui/page-header'
import { getAssetNumberTemplates } from '@/features/asset-numbers/queries'
import { AssetNumberTemplateSection } from '@/features/asset-numbers/components/asset-number-template-section'

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
  const params = await searchParams
  const activeTab = ['categories', 'locations', 'units', 'import', 'asset-numbers'].includes(params.tab ?? '')
    ? params.tab!
    : 'categories'
  const metadataSection =
    activeTab === 'categories' || activeTab === 'locations' || activeTab === 'units'
      ? activeTab
      : 'all'

  const [data, assetNumberTemplates] = await Promise.all([
    activeTab === 'import' || activeTab === 'asset-numbers'
      ? Promise.resolve({ categories: [], locations: [], units: [] })
      : getSettingsData(metadataSection),
    activeTab === 'asset-numbers' ? getAssetNumberTemplates() : Promise.resolve([]),
  ])

  const tabs = [
    { id: 'categories', label: 'หมวดหมู่พัสดุ', icon: <Tag className="h-4 w-4" /> },
    { id: 'locations', label: 'สถานที่จัดตั้ง', icon: <Building2 className="h-4 w-4" /> },
    { id: 'units', label: 'หน่วยนับ', icon: <Box className="h-4 w-4" /> },
    { id: 'import', label: 'นำเข้าพัสดุ CSV/Excel', icon: <Upload className="h-4 w-4" /> },
    { id: 'asset-numbers', label: 'เลขครุภัณฑ์', icon: <Hash className="h-4 w-4" /> },
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl text-card-foreground animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <span className="material-symbols-outlined text-[28px]">error</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-card-foreground">เกิดข้อผิดพลาดในการตั้งค่า</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{params.error}</p>
              </div>
              <Link
                href={`/settings?tab=${activeTab}`}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center"
              >
                ตกลง (เข้าใจแล้ว)
              </Link>
            </div>
          </div>
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
        {activeTab === 'asset-numbers' && (
          <AssetNumberTemplateSection templates={assetNumberTemplates} />
        )}
      </div>
    </PageContainer>
  )
}
