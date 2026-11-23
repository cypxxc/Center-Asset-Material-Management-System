'use client'

import { useContext } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DropdownMenu } from 'radix-ui'
import { Tag, Box, MapPin, Check, ChevronDown } from 'lucide-react'
import { ImportModeContext, type ImportMode } from './import-mode-context'

export function SettingsNavigation({ activeTab }: { activeTab: string }) {
  const mode = useContext(ImportModeContext)
  const router = useRouter()
  const tabs = [
    { id: 'categories', label: 'หมวดหมู่ครุภัณฑ์', icon: Tag },
    { id: 'material-categories', label: 'หมวดหมู่วัสดุ', icon: Tag },
    { id: 'units', label: 'หน่วยนับ', icon: Box },
    { id: 'locations', label: 'สถานที่', icon: MapPin },
  ]
  const tabClass = (active: boolean) => `flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-background text-primary shadow-xs' : 'text-muted-foreground hover:bg-background/50 hover:text-foreground'}`
  function selectMode(value: string) {
    const selected = value as ImportMode
    if (mode) mode.setMode(selected)
    else router.push(`/settings?tab=import&type=${selected}`)
  }
  return (
    <nav aria-label="หมวดการตั้งค่าระบบ" className="min-w-0 max-w-full overflow-x-auto">
      <div className="flex w-max min-w-full gap-1 rounded-lg bg-muted p-0.5 sm:min-w-0">
        {tabs.map(tab => <Link key={tab.id} href={`/settings?tab=${tab.id}`} scroll={false} aria-current={activeTab === tab.id ? 'page' : undefined} className={tabClass(activeTab === tab.id)}><tab.icon className="h-4 w-4" aria-hidden="true" /><span>{tab.label}</span></Link>)}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" disabled={mode?.busy} aria-current={activeTab === 'import' ? 'page' : undefined} className={`group ${tabClass(activeTab === 'import')} disabled:opacity-50`}>
              <span>นำเข้าวัสดุ</span>
              <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={6} className="z-50 min-w-[200px] max-w-[280px] max-h-[320px] overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none">
              <DropdownMenu.RadioGroup value={mode?.mode ?? ''} onValueChange={selectMode}>
                {([{ value: 'asset', label: 'นำเข้าครุภัณฑ์' }, { value: 'material', label: 'นำเข้าวัสดุ' }] as const).map(item => <DropdownMenu.RadioItem key={item.value} value={item.value} className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none transition-colors ${mode?.mode === item.value ? 'bg-primary/10 text-primary font-bold' : 'text-foreground hover:bg-muted data-[highlighted]:bg-muted'}`}><span className="truncate">{item.label}</span><DropdownMenu.ItemIndicator><Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /></DropdownMenu.ItemIndicator></DropdownMenu.RadioItem>)}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </nav>
  )
}
