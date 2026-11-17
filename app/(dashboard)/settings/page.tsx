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
import { AlertCircle } from 'lucide-react'
import { SettingsNavigation } from '@/features/settings/components/settings-navigation'
import Link from 'next/link'

import { PageHeader } from '@/components/ui/page-header'

interface SettingsPageProps {
 searchParams: Promise<{
 message?: string
 error?: string
 tab?: string
 type?: string
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

 const navigation = <SettingsNavigation activeTab={activeTab} />

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
 {(activeTab === 'categories' || activeTab === 'material-categories') && (
 <CategorySection key={activeTab} categories={data.categories} itemType={activeTab === 'material-categories' ? 'material' : 'asset'} navigation={navigation} />
 )}
 {activeTab === 'units' && (
 <UnitSection units={data.units} navigation={navigation} />
 )}
 {activeTab === 'locations' && (
 <LocationSection locations={data.locations} navigation={navigation} />
 )}
 {activeTab === 'import' && (
 <ImportSection navigation={navigation} initialFormat={params.type === 'material' ? 'material' : 'asset'} />
 )}
 </div>
 </div>
 )
}
