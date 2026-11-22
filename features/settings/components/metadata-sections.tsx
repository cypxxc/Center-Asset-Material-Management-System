'use client'

import React, { useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { getPageNumbers } from '@/features/disbursements/pagination'
import { cn } from '@/lib/utils'
import { DataTable, DataTableHeader, DataTableHead, DataTableBody, DataTableRow, DataTableCell } from '@/components/ui/data-table'
import dynamic from 'next/dynamic'
import { AssetImportForm } from './asset-import-form'
import { MaterialImportForm } from './material-import-form'
import { SettingsNavigation } from './settings-navigation'
import { ImportModeContext, type ImportMode } from './import-mode-context'

const ConfirmDialog = dynamic(
 () => import('@/components/ui/confirm-dialog').then((mod) => mod.ConfirmDialog),
 { ssr: false }
)
import {
 createCategory,
 createLocation,
 createUnit,
 updateCategory,
 updateLocation,
 updateUnit,
 deleteCategory,
 deleteLocation,
 deleteUnit,
} from '../actions'
import { CategoryRow, LocationRow, UnitRow } from '../types'

const METADATA_PAGE_SIZE = 50

function useMetadataPage<T>(items: T[], query: string) {
 const [pagination, setPagination] = useState({ query, page: 1 })
 if (pagination.query !== query) setPagination({ query, page: 1 })
 const totalPages = Math.max(1, Math.ceil(items.length / METADATA_PAGE_SIZE))
 const page = Math.min(pagination.query === query ? pagination.page : 1, totalPages)
 const offset = (page - 1) * METADATA_PAGE_SIZE
 return {
 page, totalPages, offset,
 rows: items.slice(offset, offset + METADATA_PAGE_SIZE),
 onPageChange: (page: number) => setPagination({ query, page }),
 }
}

function MetadataFooter({ page, totalPages, total, onPageChange }: {
 page: number
 totalPages: number
 total: number
 onPageChange: (page: number) => void
}) {
 return (
 <footer className="z-10 flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-2.5 text-xs text-muted-foreground shadow-inner">
 <span className="shrink-0 rounded-md border border-border bg-muted px-2.5 py-1 text-card-foreground" aria-live="polite">
 {total > 0
 ? `แสดง ${(page - 1) * METADATA_PAGE_SIZE + 1}–${Math.min(page * METADATA_PAGE_SIZE, total)} จาก ${total.toLocaleString()} รายการ`
 : 'แสดง 0 จาก 0 รายการ'}
 </span>
 <nav aria-label="การแบ่งหน้ารายการตั้งค่า" className="flex max-w-full flex-wrap items-center gap-1.5 sm:gap-2">
 <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="หน้าก่อนหน้า">ก่อนหน้า</Button>
 <div className="flex items-center gap-1">
 {getPageNumbers(page, totalPages).map((item, index) => item === 'ellipsis' ? (
 <span key={`ellipsis-${index}`} className="px-1.5" aria-hidden="true">…</span>
 ) : (
 <button key={item} type="button" onClick={() => onPageChange(item)} aria-current={item === page ? 'page' : undefined} aria-label={`หน้า ${item}`}
 className={cn('flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg border px-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring', item === page ? 'border-primary/40 bg-primary/10 text-primary shadow-xs' : 'border-transparent hover:bg-muted hover:text-foreground')}>
 {item}
 </button>
 ))}
 </div>
 <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="หน้าถัดไป">ถัดไป</Button>
 </nav>
 </footer>
 )
}

function AutoSaveName({ form, name, label }: { form: string; name: string; label: string }) {
 return (
 <input
 form={form}
 name="name"
 aria-label={label}
 defaultValue={name}
 required
 dir="auto"
 onBlur={(event) => {
 const input = event.currentTarget
 // A status change submits the same form; deletion should not also save a rename.
 const next = event.relatedTarget as HTMLInputElement | HTMLButtonElement | null
 if (next?.form === input.form && (next.type === 'checkbox' || next.type === 'button')) return
 if (input.value.trim() !== name && input.reportValidity()) input.form?.requestSubmit()
 }}
 onKeyDown={(event) => {
 if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
 event.preventDefault()
 event.currentTarget.blur()
 }
 }}
 className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
 />
 )
}

function AutoSaveStatus() {
 const { pending } = useFormStatus()
 return <span role="status" className="self-center text-xs text-muted-foreground">{pending ? 'กำลังบันทึก…' : ''}</span>
}

function MetadataSearch({ label, value, onChange }: {
 label: string
 value: string
 onChange: (value: string) => void
}) {
 return (
 <div className="order-1 min-w-0 [&>div]:max-w-none">
 <SearchInput value={value} onChange={onChange} placeholder={`ค้นหา${label}...`} aria-label={`ค้นหา${label}`} className="h-9 border-input bg-card text-xs font-normal leading-5 text-card-foreground placeholder:text-muted-foreground placeholder:font-normal focus:bg-card focus:border-ring focus:ring-ring shadow-2xs" />
 </div>
 )
}

function TextInput({
 name,
 label,
 defaultValue,
 required,
}: {
 name: string
 label: string
 defaultValue?: string | null
 required?: boolean
}) {
 return (
 <label className="block">
 <input
 name={name}
 aria-label={label}
 placeholder={label}
 defaultValue={defaultValue ?? ''}
 required={required}
 dir="auto"
 className="h-9 w-full rounded-lg border border-input bg-card px-3 text-xs font-normal leading-5 text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:border-ring focus:ring-1 focus:ring-ring transition-all shadow-2xs"
 />
 </label>
 )
}

function SubmitButton({ 
 children, 
 variant, 
 className,
 size
}: { 
 children: React.ReactNode
 variant?: React.ComponentProps<typeof Button>["variant"]
 className?: string
 size?: "default" | "sm" | "lg" | "icon" | null
}) {
 const { pending } = useFormStatus()
 return (
 <Button aria-busy={pending}
 type="submit"
 variant={variant || "default"}
 size={size || "default"}
 className={className}
 disabled={pending}
 >
 {children}
 </Button>
 )
}

function ActiveCheckbox({ defaultChecked }: { defaultChecked?: boolean }) {
 return (
 <label className="flex items-center gap-2 text-xs font-normal leading-5 text-muted-foreground cursor-pointer">
 <input
 name="is_active"
 type="checkbox"
 defaultChecked={defaultChecked}
 className="h-4 w-4 rounded border-input text-primary accent-primary cursor-pointer"
 />
 เปิดใช้งาน
 </label>
 )
}

export function CategorySection({ categories, itemType = 'asset', canDelete = true, navigation }: { categories: CategoryRow[]; itemType?: 'asset' | 'material'; canDelete?: boolean; navigation?: React.ReactNode }) {
 const [query, setQuery] = useState('')
 const filteredCategories = categories.filter(category => category.item_type === itemType && category.name.toLocaleLowerCase('th-TH').includes(query.trim().toLocaleLowerCase('th-TH')))
 const pagination = useMetadataPage(filteredCategories, query)
 const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
 const [isPending, startTransition] = useTransition()

 const activeDeleteCategory = categories.find((c) => c.id === confirmDeleteId)

 const handleDeleteConfirm = () => {
 if (!confirmDeleteId) return
 startTransition(async () => {
 await deleteCategory(confirmDeleteId)
 setConfirmDeleteId(null)
 })
 }

 return (
 <section aria-label="หมวดหมู่" className="flex min-h-0 flex-1 flex-col overflow-hidden text-card-foreground">
 <div className="grid shrink-0 grid-cols-1 items-end gap-4 border-b border-border bg-card p-4 sm:px-6 lg:grid-cols-2 xl:grid-cols-[max-content_minmax(8rem,0.6fr)_minmax(16rem,1fr)]">
 <div className="order-first min-w-0 lg:col-span-2 xl:col-span-1">{navigation}</div>
 <form action={createCategory} className="order-2 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
 <input type="hidden" name="item_type" value={itemType} />
 <TextInput name="name" label="เพิ่มชื่อหมวดหมู่" required />
 <input type="hidden" name="icon" value="Tag" />
 <input type="hidden" name="color" value="#64748B" />
 <div className="pb-2">
 <ActiveCheckbox defaultChecked />
 </div>
 <SubmitButton variant="outline-primary" className="h-9 text-xs leading-5 cursor-pointer rounded-lg px-4">เพิ่มหมวดหมู่</SubmitButton>
 </form>

 <MetadataSearch label="หมวดหมู่" value={query} onChange={setQuery} />
 </div>
 <DataTable wrapperClassName="min-h-0 flex-1 overflow-auto rounded-none border-0 bg-muted/10 shadow-none" className="table-fixed min-w-[680px] text-card-foreground">
 <caption className="sr-only">รายการหมวดหมู่{itemType === 'material' ? 'วัสดุ' : 'ครุภัณฑ์'}</caption>
 <DataTableHeader className="bg-muted/75 backdrop-blur-xs border-b border-border/80 sticky top-0 z-10">
 <tr>
 <DataTableHead className="w-12 px-2 text-center">ลำดับ</DataTableHead>
 <DataTableHead className="px-2.5">ชื่อหมวดหมู่</DataTableHead>
 <DataTableHead className="w-20 px-2.5 text-center">สถานะ</DataTableHead>
 <DataTableHead isActions className="w-40 pl-2.5 pr-6 sm:pr-8">จัดการ</DataTableHead>
 </tr>
 </DataTableHeader>
 <DataTableBody>
 {filteredCategories.length === 0 && (
 <DataTableRow><DataTableCell colSpan={4} className="py-12 text-center text-muted-foreground">{query.trim() ? 'ไม่พบหมวดหมู่ที่ตรงกับคำค้นหา' : `ยังไม่มีหมวดหมู่${itemType === 'material' ? 'วัสดุ' : 'ครุภัณฑ์'}`}</DataTableCell></DataTableRow>
 )}
 {pagination.rows.map((category, index) => {
 const formId = `category-${category.id}`
 return (
 <DataTableRow key={category.id} className="h-[42px] border-b border-border/40 text-card-foreground hover:bg-muted/40 [&>td]:h-[42px] [&>td]:px-2.5 [&>td]:py-1 [&>td]:text-xs">
 <DataTableCell className="text-center font-mono tabular-nums text-muted-foreground">{pagination.offset + index + 1}</DataTableCell>
 <DataTableCell>
 <AutoSaveName form={formId} name={category.name} label={`ชื่อหมวดหมู่ ${category.name}`} />
 </DataTableCell>
 <DataTableCell>
 <div className="flex items-center justify-center">
 <input form={formId} name="is_active" type="checkbox" onChange={(event) => event.currentTarget.form?.requestSubmit()} defaultChecked={category.is_active} aria-label={`เปิดใช้งาน ${category.name}`} className="h-4 w-4 rounded border-input accent-primary cursor-pointer" />
 </div>
 </DataTableCell>
 <DataTableCell isActions className="pr-6! sm:pr-8!">
 <form id={formId} action={updateCategory.bind(null, category.id)} className="flex justify-end gap-2"><AutoSaveStatus />
 <input type="hidden" name="item_type" value={category.item_type} />
 <input type="hidden" name="description" value={category.description ?? ''} />
 <input type="hidden" name="icon" value={category.icon || 'Tag'} />
 <input type="hidden" name="color" value={category.color ?? '#64748B'} />
 {canDelete && (
 <Button type="button" variant="destructive" size="icon" className="h-8 w-8 cursor-pointer" onClick={() => setConfirmDeleteId(category.id)} aria-label={`ลบหมวดหมู่ ${category.name}`}>
 <Trash2 className="h-3.5 w-3.5" />
 </Button>
 )}
 </form>
 </DataTableCell>
 </DataTableRow>
 )
 })}
 </DataTableBody>
 </DataTable>
 <MetadataFooter {...pagination} total={filteredCategories.length} />

 <ConfirmDialog
 open={confirmDeleteId !== null}
 title="ยืนยันการลบหมวดหมู่"
 description={`คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่ "${activeDeleteCategory?.name}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
 confirmText="ลบข้อมูล"
 cancelText="ยกเลิก"
 variant="destructive"
 isPending={isPending}
 onConfirm={handleDeleteConfirm}
 onCancel={() => setConfirmDeleteId(null)}
 />
 </section>
 )
}

export function LocationSection({ locations, canDelete = true, navigation }: { locations: LocationRow[]; canDelete?: boolean; navigation?: React.ReactNode }) {
 const [query, setQuery] = useState('')
 const filteredLocations = locations.filter(location => location.name.toLocaleLowerCase('th-TH').includes(query.trim().toLocaleLowerCase('th-TH')))
 const pagination = useMetadataPage(filteredLocations, query)
 const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
 const [isPending, startTransition] = useTransition()

 const activeDeleteLocation = locations.find((l) => l.id === confirmDeleteId)

 const handleDeleteConfirm = () => {
 if (!confirmDeleteId) return
 startTransition(async () => {
 await deleteLocation(confirmDeleteId)
 setConfirmDeleteId(null)
 })
 }

 return (
 <section aria-label="สถานที่" className="flex min-h-0 flex-1 flex-col overflow-hidden text-card-foreground">
 <div className="grid shrink-0 grid-cols-1 items-end gap-4 border-b border-border bg-card p-4 sm:px-6 lg:grid-cols-2 xl:grid-cols-[max-content_minmax(8rem,0.6fr)_minmax(16rem,1fr)]">
 <div className="order-first min-w-0 lg:col-span-2 xl:col-span-1">{navigation}</div>
 <form action={createLocation} className="order-2 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
 <TextInput name="name" label="เพิ่มสถานที่" required />
 <input type="hidden" name="is_active" value="true" />
 <SubmitButton variant="outline-primary" className="h-9 text-xs leading-5 cursor-pointer rounded-lg px-4">เพิ่มสถานที่</SubmitButton>
 </form>

 <MetadataSearch label="สถานที่" value={query} onChange={setQuery} />
 </div>
 <DataTable wrapperClassName="min-h-0 flex-1 overflow-auto rounded-none border-0 bg-muted/10 shadow-none" className="table-fixed min-w-[520px] text-card-foreground">
 <caption className="sr-only">รายการสถานที่</caption>
 <DataTableHeader className="bg-muted/75 backdrop-blur-xs border-b border-border/80 sticky top-0 z-10">
 <tr>
 <DataTableHead className="w-12 px-2 text-center">ลำดับ</DataTableHead>
 <DataTableHead className="px-2.5">สถานที่</DataTableHead>
 <DataTableHead isActions className="w-40 pl-2.5 pr-6 sm:pr-8">จัดการ</DataTableHead>
 </tr>
 </DataTableHeader>
 <DataTableBody>
 {filteredLocations.length === 0 && (
 <DataTableRow><DataTableCell colSpan={3} className="py-12 text-center text-muted-foreground">{query.trim() ? 'ไม่พบสถานที่ที่ตรงกับคำค้นหา' : 'ยังไม่มีสถานที่'}</DataTableCell></DataTableRow>
 )}
 {pagination.rows.map((location, index) => (
 <DataTableRow key={location.id} className="h-[42px] border-b border-border/40 text-card-foreground hover:bg-muted/40 [&>td]:h-[42px] [&>td]:px-2.5 [&>td]:py-1 [&>td]:text-xs">
 <DataTableCell className="text-center font-mono tabular-nums text-muted-foreground">{pagination.offset + index + 1}</DataTableCell>
 <DataTableCell>
 <AutoSaveName form={`location-${location.id}`} name={location.name} label={`ชื่อสถานที่ ${location.name}`} />
 </DataTableCell>
 <DataTableCell isActions className="pr-6! sm:pr-8!">
 <form id={`location-${location.id}`} action={updateLocation.bind(null, location.id)} className="flex justify-end gap-2"><AutoSaveStatus />
 <input type="hidden" name="building" value={location.building ?? ''} />
 <input type="hidden" name="floor" value={location.floor ?? ''} />
 <input type="hidden" name="room" value={location.room ?? ''} />
 <input type="hidden" name="department" value={location.department ?? ''} />
 <input type="hidden" name="description" value={location.description ?? ''} />
 <input type="hidden" name="is_active" value={String(location.is_active)} />
 {canDelete && (
 <Button
 type="button"
 variant="destructive"
 size="icon"
 className="h-8 w-8 cursor-pointer"
 onClick={() => setConfirmDeleteId(location.id)}
 title="ลบสถานที่"
 aria-label={`ลบสถานที่ ${location.name}`}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 )}
 </form>
 </DataTableCell>
 </DataTableRow>
 ))}
 </DataTableBody>
 </DataTable>
 <MetadataFooter {...pagination} total={filteredLocations.length} />

 <ConfirmDialog
 open={confirmDeleteId !== null}
 title="ยืนยันการลบสถานที่"
 description={`คุณแน่ใจหรือไม่ว่าต้องการลบสถานที่ "${activeDeleteLocation?.name}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
 confirmText="ลบข้อมูล"
 cancelText="ยกเลิก"
 variant="destructive"
 isPending={isPending}
 onConfirm={handleDeleteConfirm}
 onCancel={() => setConfirmDeleteId(null)}
 />
 </section>
 )
}

export function UnitSection({ units, canDelete = true, navigation }: { units: UnitRow[]; canDelete?: boolean; navigation?: React.ReactNode }) {
 const [query, setQuery] = useState('')
 const filteredUnits = units.filter(unit => unit.name.toLocaleLowerCase('th-TH').includes(query.trim().toLocaleLowerCase('th-TH')))
 const pagination = useMetadataPage(filteredUnits, query)
 const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
 const [isPending, startTransition] = useTransition()

 const activeDeleteUnit = units.find((u) => u.id === confirmDeleteId)

 const handleDeleteConfirm = () => {
 if (!confirmDeleteId) return
 startTransition(async () => {
 await deleteUnit(confirmDeleteId)
 setConfirmDeleteId(null)
 })
 }

 return (
 <section aria-label="หน่วยนับ" className="flex min-h-0 flex-1 flex-col overflow-hidden text-card-foreground">
 <div className="grid shrink-0 grid-cols-1 items-end gap-4 border-b border-border bg-card p-4 sm:px-6 lg:grid-cols-2 xl:grid-cols-[max-content_minmax(8rem,0.6fr)_minmax(16rem,1fr)]">
 <div className="order-first min-w-0 lg:col-span-2 xl:col-span-1">{navigation}</div>
 <form action={createUnit} className="order-2 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
 <TextInput name="name" label="เพิ่มชื่อหน่วยนับ" required />
 <div className="pb-2">
 <ActiveCheckbox defaultChecked />
 </div>
 <SubmitButton variant="outline-primary" className="h-9 text-xs leading-5 cursor-pointer rounded-lg px-4">เพิ่มหน่วยนับ</SubmitButton>
 </form>

 <MetadataSearch label="หน่วยนับ" value={query} onChange={setQuery} />
 </div>
 <DataTable wrapperClassName="min-h-0 flex-1 overflow-auto rounded-none border-0 bg-muted/10 shadow-none" className="table-fixed min-w-[680px] text-card-foreground">
 <caption className="sr-only">รายการหน่วยนับ</caption>
 <DataTableHeader className="bg-muted/75 backdrop-blur-xs border-b border-border/80 sticky top-0 z-10">
 <tr>
 <DataTableHead className="w-12 px-2 text-center">ลำดับ</DataTableHead>
 <DataTableHead className="px-2.5">ชื่อหน่วยนับ</DataTableHead>
 <DataTableHead className="w-20 px-2.5 text-center">สถานะ</DataTableHead>
 <DataTableHead isActions className="w-40 pl-2.5 pr-6 sm:pr-8">จัดการ</DataTableHead>
 </tr>
 </DataTableHeader>
 <DataTableBody>
 {filteredUnits.length === 0 && (
 <DataTableRow><DataTableCell colSpan={4} className="py-12 text-center text-muted-foreground">{query.trim() ? 'ไม่พบหน่วยนับที่ตรงกับคำค้นหา' : 'ยังไม่มีหน่วยนับ'}</DataTableCell></DataTableRow>
 )}
 {pagination.rows.map((unit, index) => (
 <DataTableRow key={unit.id} className="h-[42px] border-b border-border/40 text-card-foreground hover:bg-muted/40 [&>td]:h-[42px] [&>td]:px-2.5 [&>td]:py-1 [&>td]:text-xs">
 <DataTableCell className="text-center font-mono tabular-nums text-muted-foreground">{pagination.offset + index + 1}</DataTableCell>
 <DataTableCell>
 <AutoSaveName form={`unit-${unit.id}`} name={unit.name} label={`ชื่อหน่วยนับ ${unit.name}`} />
 </DataTableCell>
 <DataTableCell>
 <div className="flex items-center justify-center">
 <input form={`unit-${unit.id}`} name="is_active" type="checkbox" onChange={(event) => event.currentTarget.form?.requestSubmit()} defaultChecked={unit.is_active} aria-label={`เปิดใช้งาน ${unit.name}`} className="h-4 w-4 rounded border-input accent-primary cursor-pointer" />
 </div>
 </DataTableCell>
 <DataTableCell isActions className="pr-6! sm:pr-8!">
 <form id={`unit-${unit.id}`} action={updateUnit.bind(null, unit.id)} className="flex justify-end gap-2"><AutoSaveStatus />
 {canDelete && (
 <Button
 type="button"
 variant="destructive"
 size="icon"
 className="h-8 w-8 cursor-pointer"
 onClick={() => setConfirmDeleteId(unit.id)}
 title="ลบหน่วยนับ"
 aria-label={`ลบหน่วยนับ ${unit.name}`}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 )}
 </form>
 </DataTableCell>
 </DataTableRow>
 ))}
 </DataTableBody>
 </DataTable>
 <MetadataFooter {...pagination} total={filteredUnits.length} />

 <ConfirmDialog
 open={confirmDeleteId !== null}
 title="ยืนยันการลบหน่วยนับ"
 description={`คุณแน่ใจหรือไม่ว่าต้องการลบหน่วยนับ "${activeDeleteUnit?.name}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
 confirmText="ลบข้อมูล"
 cancelText="ยกเลิก"
 variant="destructive"
 isPending={isPending}
 onConfirm={handleDeleteConfirm}
 onCancel={() => setConfirmDeleteId(null)}
 />
 </section>
 )
}

export function ImportSection({ navigation, initialFormat = 'asset' }: { navigation?: React.ReactNode; initialFormat?: ImportMode }) {
 const [format, setFormat] = useState<ImportMode>(initialFormat)
 const [busy, setBusy] = useState(false)
 return (
 <ImportModeContext.Provider value={{ mode: format, busy, setMode: setFormat }}>
 <section aria-label="นำเข้าวัสดุ" className="flex min-h-0 flex-1 flex-col overflow-hidden text-card-foreground">
  <div className="flex shrink-0 items-center gap-4 border-b border-border bg-card p-4 sm:px-6">
   {navigation ?? <SettingsNavigation activeTab="import" />}
  </div>
  <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
   {format === 'asset' ? <AssetImportForm onBusyChange={setBusy} /> : <MaterialImportForm onBusyChange={setBusy} />}
  </div>
 </section>
 </ImportModeContext.Provider>
 )
}
