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
import { Tag, Box, Upload, AlertCircle, MapPin } from 'lucide-react'
import Link from 'next/link'

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
 { id: 'categories', label: 'หมวดหมู่ครุภัณฑ์', icon: <Tag className="h-4 w-4" /> },
 { id: 'units', label: 'หน่วยนับ', icon: <Box className="h-4 w-4" /> },
 { id: 'locations', label: 'สถานที่', icon: <MapPin className="h-4 w-4" /> },
 { id: 'import', label: 'นำเข้าพัสดุ CSV/Excel', icon: <Upload className="h-4 w-4" /> },
 ]

 const navigation = (
 <nav aria-label="หมวดการตั้งค่าระบบ" className="min-w-0 max-w-full overflow-x-auto">
 <div className="flex w-max min-w-full gap-1 rounded-lg bg-muted p-0.5 sm:min-w-0">
 {tabs.map(tab => (
 <Link key={tab.id} href={`/settings?tab=${tab.id}`} scroll={false}
 aria-current={activeTab === tab.id ? 'page' : undefined}
 className={`flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab === tab.id ? 'bg-background text-primary shadow-xs' : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'}`}>
 {tab.icon}<span>{tab.label}</span>
 </Link>
 ))}
 </div>
 </nav>
 )

 return (
 <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
 <div className="shrink-0">
 <div className="flex h-14 shrink-0 items-center border-b border-border px-4 sm:px-6">
 <PageHeader
 title="ตั้งค่าระบบ"
 />
 </div>

 {params.message && (
 <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-600 animate-in fade-in duration-200">
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


 </div>

 {/* Tab Contents */}
 <div className="flex min-h-0 flex-1 flex-col overflow-hidden animate-in fade-in duration-200">
 {activeTab === 'categories' && (
 <CategorySection categories={data.categories} navigation={navigation} />
 )}
 {activeTab === 'units' && (
 <UnitSection units={data.units} navigation={navigation} />
 )}
 {activeTab === 'locations' && (
 <LocationSection locations={data.locations} navigation={navigation} />
 )}
 {activeTab === 'import' && (
 <ImportSection navigation={navigation} />
 )}
 </div>
 </div>
 )
}
