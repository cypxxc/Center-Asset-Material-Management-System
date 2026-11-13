'use client'

import React, { useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { Upload, FileText, CheckCircle2, AlertCircle, Trash2, Download, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { getPageNumbers } from '@/features/disbursements/pagination'
import { cn } from '@/lib/utils'
import { DataTable, DataTableHeader, DataTableHead, DataTableBody, DataTableRow, DataTableCell } from '@/components/ui/data-table'
import dynamic from 'next/dynamic'
import { importItemsBulk } from '@/features/items/actions'

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
 variant?: "link" | "default" | "destructive" | "outline" | "secondary" | "ghost" | null
 className?: string
 size?: "default" | "sm" | "lg" | "icon" | null
}) {
 const { pending } = useFormStatus()
 return (
 <Button
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

export function CategorySection({ categories, canDelete = true, navigation }: { categories: CategoryRow[]; canDelete?: boolean; navigation?: React.ReactNode }) {
 const [query, setQuery] = useState('')
 const filteredCategories = categories.filter(category => category.name.toLocaleLowerCase('th-TH').includes(query.trim().toLocaleLowerCase('th-TH')))
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
 <TextInput name="name" label="เพิ่มชื่อหมวดหมู่" required />
 <input type="hidden" name="icon" value="Tag" />
 <input type="hidden" name="color" value="#64748B" />
 <div className="pb-2">
 <ActiveCheckbox defaultChecked />
 </div>
 <SubmitButton className="h-9 font-normal text-xs leading-5 cursor-pointer rounded-lg px-4">เพิ่มหมวดหมู่</SubmitButton>
 </form>

 <MetadataSearch label="หมวดหมู่" value={query} onChange={setQuery} />
 </div>
 <DataTable wrapperClassName="min-h-0 flex-1 overflow-auto rounded-none border-0 bg-muted/10 shadow-none" className="table-fixed min-w-[680px] text-card-foreground">
 <caption className="sr-only">รายการหมวดหมู่ครุภัณฑ์</caption>
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
 <DataTableRow><DataTableCell colSpan={4} className="py-12 text-center text-muted-foreground">{query.trim() ? 'ไม่พบหมวดหมู่ที่ตรงกับคำค้นหา' : 'ยังไม่มีหมวดหมู่ครุภัณฑ์'}</DataTableCell></DataTableRow>
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
 <SubmitButton className="h-9 font-normal text-xs leading-5 cursor-pointer rounded-lg px-4">เพิ่มสถานที่</SubmitButton>
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
 <SubmitButton className="h-9 font-normal text-xs leading-5 cursor-pointer rounded-lg px-4">เพิ่มหน่วยนับ</SubmitButton>
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

export function ImportSection({ navigation }: { navigation?: React.ReactNode }) {
 const [isUploading, setIsUploading] = useState(false)
 const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

 const downloadTemplate = async () => {
 try {
 const ExcelJS = (await import('exceljs')).default
 const workbook = new ExcelJS.Workbook()
 const worksheet = workbook.addWorksheet('ทะเบียนคุมสินทรัพย์')

 worksheet.columns = [
 { header: 'ลำดับ', key: 'index', width: 8 },
 { header: 'วัน เดือน ปีที่รับ', key: 'acquired_date', width: 16 },
 { header: 'รับจาก (งปม.)', key: 'budget_source', width: 24 },
 { header: 'รายการครุภัณฑ์', key: 'item_name', width: 35 },
 { header: 'สถานะตามเกณฑ์', key: 'qualification_status', width: 20 },
 { header: 'ยี่ห้อ/รุ่น', key: 'brand_model', width: 35 },
 { header: 'ราคา', key: 'unit_price', width: 14 },
 { header: 'หน่วย', key: 'unit_name', width: 10 },
 { header: 'เลขครุภัณฑ์', key: 'asset_no', width: 26 },
 { header: 'เลขสินทรัพย์', key: 'gfmis_number', width: 18 },
 { header: 'ผู้ครอบครอง', key: 'responsible_person', width: 22 },
 { header: 'ใช้งานที่', key: 'location_name', width: 22 },
 { header: 'ใช้งานได้', key: 'condition_usable', width: 12 },
 { header: 'ชำรุด', key: 'condition_damaged', width: 10 },
 { header: 'เสื่อมสภาพ', key: 'condition_deteriorated', width: 12 },
 { header: 'หมายเหตุ', key: 'note', width: 20 },
 ]

 // Add a styled header row matching official government ledger styling
 worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
 worksheet.getRow(1).fill = {
 type: 'pattern',
 pattern: 'solid',
 fgColor: { argb: 'FF1E293B' }, // Slate 800
 }

 // Add official example rows
 worksheet.addRow({
 index: 1,
 acquired_date: '22-ก.ค.-64',
 budget_source: 'เงินบำรุง สสจ.ขก.',
 item_name: 'เครื่องคอมพิวเตอร์โน้ตบุ๊ก สำหรับงานประมวลผล (ตัวอย่าง)',
 qualification_status: 'ตามเกณฑ์',
 brand_model: 'Notebook Acer TravelMate TMP214-53-53XD/T01C (Black) s/n : NXVPNST01C1210D4027600',
 unit_price: 21800,
 unit_name: 'เครื่อง',
 asset_no: 'สนง.7 7440-002-0005-2/2564',
 gfmis_number: '110000069558',
 responsible_person: 'กลุ่มงานสุขภาพดิจิทัล',
 location_name: 'กลุ่มงานสุขภาพดิจิทัล',
 condition_usable: '/',
 condition_damaged: '',
 condition_deteriorated: '',
 note: 'ส่วนกลาง',
 })

 worksheet.addRow({
 index: 2,
 acquired_date: '19-พ.ย.-64',
 budget_source: 'เงินกู้ (ไวรัสโคโรนา 2019)',
 item_name: 'เครื่องคอมพิวเตอร์โน้ตบุ๊ก สำหรับงานประมวลผล (ตัวอย่าง)',
 qualification_status: 'ตามเกณฑ์',
 brand_model: 'Lenovo/ThinkPad L13 Gen2 20VH002F TA',
 unit_price: 22000,
 unit_name: 'ชุด',
 asset_no: 'สนง.7 7440-002-0005-1/2565',
 gfmis_number: '110000105470',
 responsible_person: 'กลุ่มงานสุขภาพดิจิทัล',
 location_name: 'ห้องประชุม EOC (ชั้น 4)',
 condition_usable: '/',
 condition_damaged: '',
 condition_deteriorated: '',
 note: '',
 })

 const buffer = await workbook.xlsx.writeBuffer()
 const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
 const url = window.URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = `camms_import_template.xlsx`
 document.body.appendChild(a)
 a.click()
 document.body.removeChild(a)
 window.URL.revokeObjectURL(url)
 } catch {
 alert('ไม่สามารถดาวน์โหลดเทมเพลตได้')
 }
 }

 const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0]
 if (!file) return

 setIsUploading(true)
 setResult(null)

 try {
 const isXlsx = file.name.endsWith('.xlsx')

 if (isXlsx) {
 const ExcelJS = (await import('exceljs')).default
 const { convertExcelToStandardCSV } = await import('@/features/items/excel-importer')
 const workbook = new ExcelJS.Workbook()
 const arrayBuffer = await file.arrayBuffer()
 await workbook.xlsx.load(arrayBuffer)

 if (!workbook.worksheets || workbook.worksheets.length === 0) {
 setIsUploading(false)
 setResult({ type: 'error', message: 'ไม่พบตารางข้อมูลในไฟล์ Excel' })
 return
 }

 const csvContent = convertExcelToStandardCSV(workbook)
 const res = await importItemsBulk(csvContent)
 setIsUploading(false)
 if (res.success) {
 setResult({ type: 'success', message: res.message || 'นำเข้าข้อมูลพัสดุครุภัณฑ์สำเร็จเรียบร้อยแล้ว' })
 } else {
 setResult({ type: 'error', message: res.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล' })
 }
 } else {
 // Handle normal CSV import
 const reader = new FileReader()
 reader.onload = async (event) => {
 const csvText = event.target?.result as string
 if (!csvText) {
 setIsUploading(false)
 setResult({ type: 'error', message: 'ไม่สามารถอ่านข้อมูลในไฟล์ได้' })
 return
 }

 const res = await importItemsBulk(csvText)
 setIsUploading(false)
 if (res.success) {
 setResult({ type: 'success', message: res.message || 'นำเข้าข้อมูลพัสดุครุภัณฑ์สำเร็จเรียบร้อยแล้ว' })
 } else {
 setResult({ type: 'error', message: res.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล' })
 }
 }
 reader.onerror = () => {
 setIsUploading(false)
 setResult({ type: 'error', message: 'การอ่านไฟล์ล้มเหลว' })
 }
 reader.readAsText(file, 'UTF-8')
 }
 } catch (err) {
 const errMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการนำเข้า'
 setIsUploading(false)
 setResult({ type: 'error', message: errMsg })
 } finally {
 e.target.value = ''
 }
 }

 return (
 <section aria-label="นำเข้าพัสดุ CSV/Excel" className="flex min-h-0 flex-1 flex-col overflow-hidden text-card-foreground">
 <div className="grid shrink-0 grid-cols-1 items-end gap-4 border-b border-border bg-card p-4 sm:px-6 lg:grid-cols-2 xl:grid-cols-[max-content_minmax(8rem,0.6fr)_minmax(16rem,1fr)]">
 <div className="min-w-0 lg:col-span-2 xl:col-span-1">{navigation}</div>
 </div>
 <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
 {/* Upload Zone */}
 <div className="relative border-2 border-dashed border-border rounded-2xl p-8 bg-muted/30 hover:bg-muted/50 transition-colors flex flex-col items-center justify-center text-center space-y-4">
 {isUploading ? (
 <div className="flex flex-col items-center space-y-2 animate-pulse">
 <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
 <span className="text-xs font-bold text-muted-foreground">กำลังนำเข้าและบันทึกข้อมูลพัสดุ...</span>
 </div>
 ) : (
 <>
 <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-2xs">
 <FileSpreadsheet className="h-6 w-6 text-primary" />
 </div>
 <div className="space-y-1">
 <h4 className="text-sm font-bold text-card-foreground">เลือกไฟล์ Excel (.xlsx) หรือ CSV เพื่อนำเข้าข้อมูล</h4>
 <p className="text-xs text-muted-foreground">ขนาดไฟล์ไม่เกิน 10MB และควรจัดรูปแบบคอลัมน์ให้ตรงตามรูปแบบเทมเพลต</p>
 </div>
 <div className="flex items-center gap-3">
 <button
 type="button"
 onClick={downloadTemplate}
 className="h-9 px-4 rounded-lg border border-input hover:bg-muted bg-card text-card-foreground text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
 >
 <Download className="h-4 w-4 text-muted-foreground" />
 <span>ดาวน์โหลดเทมเพลต (Excel)</span>
 </button>
 <label className="h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer">
 <Upload className="h-3.5 w-3.5" />
 <span>เลือกไฟล์เพื่ออัปโหลด</span>
 <input
 type="file"
 accept=".csv, .xlsx"
 className="hidden"
 onChange={handleFileChange}
 />
 </label>
 </div>
 </>
 )}
 </div>

 {/* Results Banner */}
 {result && (
 <div className={`rounded-xl border p-4 flex items-start gap-3 animate-in fade-in duration-200 ${
 result.type === 'success'
 ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 '
 : 'border-destructive/20 bg-destructive/10 text-destructive'
 }`}>
 {result.type === 'success' ? (
 <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
 ) : (
 <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
 )}
 <div className="space-y-1 w-full min-w-0">
 <h5 className="text-xs font-bold">{result.type === 'success' ? 'การนำเข้าสำเร็จ' : 'เกิดข้อผิดพลาดในการนำเข้า'}</h5>
 <div className="text-[11px] leading-relaxed opacity-90 whitespace-pre-line max-h-60 overflow-y-auto pr-2 font-mono font-normal">
 {result.message}
 </div>
 </div>
 </div>
 )}

 {/* CSV Format Guide */}
 <div className="rounded-xl border border-border p-6 bg-card space-y-3 shadow-2xs text-card-foreground">
 <div className="flex items-center gap-2 text-card-foreground">
 <FileText className="h-4 w-4 text-primary" />
 <h4 className="text-xs font-bold">โครงสร้างไฟล์ CSV ที่ระบบแนะนำ (CSV Column Schema)</h4>
 </div>
 <p className="text-[11px] text-muted-foreground leading-relaxed">
 แถวแรกของไฟล์ CSV (Header Row) จะต้องประกอบด้วยชื่อหัวข้อคอลัมน์ต่อไปนี้ (พิมพ์ภาษาอังกฤษพิมพ์เล็ก):
 </p>
 <p className="text-[11px] text-muted-foreground leading-relaxed">
 ไฟล์ Excel จะอ่านสถานะตามเกณฑ์จากหัวข้อของแต่ละแผ่นงานให้อัตโนมัติ ส่วน CSV ต้องมีคอลัมน์ qualification_status สำหรับครุภัณฑ์
 </p>

 <div className="overflow-x-auto rounded-lg border border-border mt-2">
 <table className="table-data-uniform w-full text-left text-[11px] border-collapse bg-card">
 <thead>
 <tr className="border-b border-border bg-muted/50 text-muted-foreground font-bold">
 <th className="p-2 border-r border-border">หัวข้อคอลัมน์ (Header)</th>
 <th className="p-2 border-r border-border">ข้อมูลที่รองรับ</th>
 <th className="p-2">ตัวอย่างข้อมูล</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-border text-card-foreground font-medium">
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">item_name</td>
 <td className="p-2 border-r border-border">ชื่อสิ่งของ/พัสดุครุภัณฑ์ (จำเป็น)</td>
 <td className="p-2">เครื่องคอมพิวเตอร์พกพา MacBook Air</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">item_type</td>
 <td className="p-2 border-r border-border">ประเภทสิ่งของ: asset (ครุภัณฑ์) / material (พัสดุ)</td>
 <td className="p-2">asset</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">qualification_status</td>
 <td className="p-2 border-r border-border">สถานะตามเกณฑ์ครุภัณฑ์ (จำเป็นสำหรับ asset)</td>
 <td className="p-2">qualified หรือ below_threshold</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">quantity</td>
 <td className="p-2 border-r border-border">จำนวนพัสดุครุภัณฑ์ (ตัวเลขจำนวนเต็ม)</td>
 <td className="p-2">1</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">unit_price</td>
 <td className="p-2 border-r border-border">ราคาต่อหน่วย ใช้คำนวณมูลค่าในรายงาน (ไม่บังคับ)</td>
 <td className="p-2">35900</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">brand</td>
 <td className="p-2 border-r border-border">ยี่ห้อ/แบรนด์</td>
 <td className="p-2">Apple</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">model</td>
 <td className="p-2 border-r border-border">รุ่นสินค้า</td>
 <td className="p-2">M2 (2022)</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">asset_no</td>
 <td className="p-2 border-r border-border">รหัสเลขครุภัณฑ์ (เฉพาะครุภัณฑ์)</td>
 <td className="p-2">CAMMS-AS-9872</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">serial_no</td>
 <td className="p-2 border-r border-border">รหัสซีเรียลนัมเบอร์สินค้า (SN)</td>
 <td className="p-2">C02H20YQ088G</td>
 </tr>
 <tr className="hover:bg-muted/40">
 <td className="p-2 border-r border-border font-mono text-[11px] text-primary font-semibold">status</td>
 <td className="p-2 border-r border-border">สถานะ: active (ใช้งานได้) / damaged (ชำรุด) / inactive (เสื่อมสภาพ)</td>
 <td className="p-2">active</td>
 </tr>
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </section>
 )
}
