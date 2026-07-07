'use client'

import React, { useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { Box, Building2, Save, Tag, Users, Upload, FileText, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react'
import { formatDisplayEmail, isInternalEmail } from '@/lib/auth/display-email'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { importItemsBulk } from '@/features/items/actions'
import {
  createCategory,
  createLocation,
  createUnit,
  updateCategory,
  updateLocation,
  updateUnit,
  updateProfile,
  deleteCategory,
  deleteLocation,
  deleteUnit,
} from '../actions'
import { CategoryRow, LocationRow, UnitRow, ProfileRow } from '../types'

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? 'inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-100'
          : 'inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 border border-slate-200'
      }
    >
      {active ? 'เปิดใช้งาน (Active)' : 'ปิดใช้งาน (Inactive)'}
    </span>
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
    <label className="space-y-1 block">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        dir="auto"
        className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs focus:outline-none focus:border-primary focus:bg-white transition-all"
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
    <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer">
      <input
        name="is_active"
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
      />
      เปิดใช้งาน
    </label>
  )
}

function SectionShell({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-100 p-6 bg-slate-50/30">
        <div className="rounded-lg border border-primary/10 bg-blue-50 p-2 text-blue-600">{icon}</div>
        <div>
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="space-y-4 p-6">{children}</div>
    </section>
  )
}

export function CategorySection({ categories }: { categories: CategoryRow[] }) {
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
    <SectionShell
      title="หมวดหมู่ครุภัณฑ์ (Categories)"
      description="จัดการกลุ่มหรือประเภทหลักที่ใช้ในการขึ้นทะเบียนครุภัณฑ์และพัสดุอุปกรณ์สำนักงาน"
      icon={<Tag className="h-5 w-5" />}
    >
      <form action={createCategory} className="grid gap-3 rounded-lg border border-dashed border-slate-200 p-3 md:grid-cols-[1fr_1.4fr_auto_auto] md:items-end">
        <TextInput name="name" label="ชื่อหมวดหมู่ใหม่" required />
        <TextInput name="description" label="คำอธิบายเพิ่มเติม" />
        <div className="pb-2">
          <ActiveCheckbox defaultChecked />
        </div>
        <SubmitButton className="h-9 font-bold text-xs cursor-pointer rounded-lg px-4">เพิ่มหมวดหมู่</SubmitButton>
      </form>

      <div className="space-y-3">
        {categories.map((category) => (
          <form
            key={category.id}
            action={updateCategory.bind(null, category.id)}
            className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-[1fr_1.4fr_auto_auto] md:items-end hover:bg-slate-50/30 transition-colors"
          >
            <TextInput name="name" label="ชื่อหมวดหมู่" defaultValue={category.name} required />
            <TextInput name="description" label="คำอธิบายเพิ่มเติม" defaultValue={category.description} />
            <div className="flex items-center gap-3 pb-2.5">
              <ActiveCheckbox defaultChecked={category.is_active} />
              <StatusBadge active={category.is_active} />
            </div>
            <div className="flex gap-2">
              <SubmitButton variant="outline" className="h-9 font-bold text-xs cursor-pointer rounded-lg px-4">
                <Save className="h-3.5 w-3.5 mr-1" />
                บันทึก
              </SubmitButton>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg"
                onClick={() => setConfirmDeleteId(category.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </form>
        ))}
      </div>

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
    </SectionShell>
  )
}

export function LocationSection({ locations }: { locations: LocationRow[] }) {
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
    <SectionShell
      title="สถานที่จัดตั้งและอาคาร (Locations)"
      description="สถานที่ ห้อง แผนก หรืออาคารจัดตั้งที่ระบุในรายการพัสดุครุภัณฑ์สำนักงาน"
      icon={<Building2 className="h-5 w-5" />}
    >
      <form action={createLocation} className="grid gap-3 rounded-lg border border-dashed border-slate-200 p-3 md:grid-cols-3 lg:grid-cols-[1fr_1fr_0.7fr_0.7fr_1fr_auto_auto] md:items-end">
        <TextInput name="name" label="ชื่อห้อง/สถานที่ใหม่" required />
        <TextInput name="building" label="อาคาร" />
        <TextInput name="floor" label="ชั้น" />
        <TextInput name="room" label="ห้อง" />
        <TextInput name="department" label="แผนก/ส่วนงาน" />
        <div className="pb-2">
          <ActiveCheckbox defaultChecked />
        </div>
        <SubmitButton className="h-9 font-bold text-xs cursor-pointer rounded-lg px-4">เพิ่มสถานที่</SubmitButton>
      </form>

      <div className="space-y-3">
        {locations.map((location) => (
          <form
            key={location.id}
            action={updateLocation.bind(null, location.id)}
            className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-3 lg:grid-cols-[1fr_1fr_0.7fr_0.7fr_1fr_auto_auto] md:items-end hover:bg-slate-50/30 transition-colors"
          >
            <TextInput name="name" label="ชื่อห้อง/สถานที่" defaultValue={location.name} required />
            <TextInput name="building" label="อาคาร" defaultValue={location.building} />
            <TextInput name="floor" label="ชั้น" defaultValue={location.floor} />
            <TextInput name="room" label="ห้อง" defaultValue={location.room} />
            <TextInput name="department" label="แผนก/ส่วนงาน" defaultValue={location.department} />
            <div className="flex items-center gap-3 pb-2.5">
              <ActiveCheckbox defaultChecked={location.is_active} />
              <StatusBadge active={location.is_active} />
            </div>
            <div className="flex gap-2">
              <SubmitButton variant="outline" className="h-9 font-bold text-xs cursor-pointer rounded-lg px-4">
                <Save className="h-3.5 w-3.5 mr-1" />
                บันทึก
              </SubmitButton>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg"
                onClick={() => setConfirmDeleteId(location.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </form>
        ))}
      </div>

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
    </SectionShell>
  )
}

export function UnitSection({ units }: { units: UnitRow[] }) {
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
    <SectionShell
      title="หน่วยนับสิ่งของ (Units)"
      description="หน่วยนับในการตรวจนับปริมาณสิ่งของเพื่อการจัดระเบียบคลัง เช่น ชิ้น, เครื่อง, ตัว, กล่อง"
      icon={<Box className="h-5 w-5" />}
    >
      <form action={createUnit} className="grid gap-3 rounded-lg border border-dashed border-slate-200 p-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <TextInput name="name" label="ชื่อหน่วยนับใหม่" required />
        <div className="pb-2">
          <ActiveCheckbox defaultChecked />
        </div>
        <SubmitButton className="h-9 font-bold text-xs cursor-pointer rounded-lg px-4">เพิ่มหน่วยนับ</SubmitButton>
      </form>

      <div className="space-y-3">
        {units.map((unit) => (
          <form
            key={unit.id}
            action={updateUnit.bind(null, unit.id)}
            className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-[1fr_auto_auto] md:items-end hover:bg-slate-50/30 transition-colors"
          >
            <TextInput name="name" label="ชื่อหน่วยนับ" defaultValue={unit.name} required />
            <div className="flex items-center gap-3 pb-2.5">
              <ActiveCheckbox defaultChecked={unit.is_active} />
              <StatusBadge active={unit.is_active} />
            </div>
            <div className="flex gap-2">
              <SubmitButton variant="outline" className="h-9 font-bold text-xs cursor-pointer rounded-lg px-4">
                <Save className="h-3.5 w-3.5 mr-1" />
                บันทึก
              </SubmitButton>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg"
                onClick={() => setConfirmDeleteId(unit.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </form>
        ))}
      </div>

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
    </SectionShell>
  )
}

export function ProfileSection({ profiles }: { profiles: ProfileRow[] }) {
  return (
    <SectionShell
      title="สิทธิ์และผู้ใช้งานระบบ (User Profiles)"
      description="จัดการบทบาทหน้าที่ (Roles) และเปิดสิทธิ์การใช้งานระบบให้กับบัญชีเจ้าหน้าที่ผู้ใช้งาน"
      icon={<Users className="h-5 w-5" />}
    >
      <div className="space-y-3">
        {profiles.map((profile) => {
          const updateProfileWithId = updateProfile.bind(null, profile.id)
          return (
            <form
              key={profile.id}
              action={updateProfileWithId}
              className="grid gap-3 rounded-lg border border-slate-100 p-4 bg-white shadow-sm md:grid-cols-[1.5fr_1.2fr_1fr_auto] md:items-center hover:bg-slate-50/30 transition-colors"
            >
              <div>
                <div className="font-bold text-slate-800">{profile.full_name}</div>
                <div className={isInternalEmail(profile.email) ? 'text-xs text-slate-500 mt-0.5' : 'text-xs text-slate-400 font-mono mt-0.5 break-all'}>
                  {formatDisplayEmail(profile.email)}
                </div>
              </div>

              <div>
                <label className="space-y-1 block">
                  <span className="text-xs font-semibold text-slate-500 block">บทบาทสิทธิ์</span>
                  <select
                    name="role"
                    defaultValue={profile.role}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs focus:outline-none focus:border-primary focus:bg-white cursor-pointer"
                  >
                    <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                    <option value="staff">เจ้าหน้าที่ (Staff)</option>
                    <option value="viewer">ผู้เข้าชม (Viewer)</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2 md:pt-0">
                <input
                  name="is_active"
                  type="checkbox"
                  defaultChecked={profile.is_active}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-500 cursor-pointer">เปิดสิทธิ์ใช้งานบัญชี</span>
              </div>

              <div className="text-right">
                <SubmitButton size="sm" className="h-9 px-4 font-bold text-xs cursor-pointer rounded-lg">
                  <Save className="h-3.5 w-3.5 mr-1" />
                  บันทึกสิทธิ์
                </SubmitButton>
              </div>
            </form>
          )
        })}
        {profiles.length === 0 && (
          <EmptyState
            title="ไม่พบข้อมูลผู้ปฏิบัติงานในระบบขณะนี้"
            className="border-0 shadow-none bg-transparent py-6 min-h-0"
          />
        )}
      </div>
    </SectionShell>
  )
}

export function ImportSection() {
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const downloadTemplate = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('เทมเพลตนำเข้าพัสดุครุภัณฑ์')

      worksheet.columns = [
        { header: 'item_name', key: 'item_name', width: 30 },
        { header: 'item_type', key: 'item_type', width: 15 },
        { header: 'quantity', key: 'quantity', width: 10 },
        { header: 'unit_price', key: 'unit_price', width: 14 },
        { header: 'brand', key: 'brand', width: 15 },
        { header: 'model', key: 'model', width: 15 },
        { header: 'asset_no', key: 'asset_no', width: 20 },
        { header: 'serial_no', key: 'serial_no', width: 20 },
        { header: 'status', key: 'status', width: 15 },
        { header: 'category_name', key: 'category_name', width: 20 },
        { header: 'location_name', key: 'location_name', width: 20 },
        { header: 'unit_name', key: 'unit_name', width: 15 },
        { header: 'note', key: 'note', width: 25 },
      ]

      // Add a styled header row
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }, // Blue 600
      }

      // Add example rows
      worksheet.addRow({
        item_name: 'เครื่องคอมพิวเตอร์ MacBook Air (ตัวอย่าง)',
        item_type: 'asset',
        quantity: 1,
        unit_price: 35900,
        brand: 'Apple',
        model: 'M2',
        asset_no: 'CAMMS-AS-9872',
        serial_no: 'C02H20YQ088G',
        status: 'active',
        category_name: 'ครุภัณฑ์คอมพิวเตอร์',
        location_name: 'ห้องทำงาน 301',
        unit_name: 'เครื่อง',
        note: 'ของฝ่ายไอที',
      })

      worksheet.addRow({
        item_name: 'กระดาษ A4 80 แกรม (ตัวอย่าง)',
        item_type: 'material',
        quantity: 5,
        unit_price: 125,
        brand: 'Double A',
        model: '-',
        asset_no: '',
        serial_no: '',
        status: 'active',
        category_name: 'วัสดุสำนักงาน',
        location_name: 'ห้องเก็บของชั้น 1',
        unit_name: 'รีม',
        note: 'สำรองสำหรับฝ่ายบุคคล',
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
        const workbook = new ExcelJS.Workbook()
        const arrayBuffer = await file.arrayBuffer()
        await workbook.xlsx.load(arrayBuffer)

        const worksheet = workbook.worksheets[0]
        if (!worksheet) {
          setIsUploading(false)
          setResult({ type: 'error', message: 'ไม่พบตารางข้อมูลในไฟล์ Excel' })
          return
        }

        // Get headers from row 1
        const headerRow = worksheet.getRow(1)
        const headers: string[] = []
        headerRow.eachCell((cell) => {
          headers.push(String(cell.value || '').trim())
        })

        // Build CSV string from the sheet data
        const csvLines: string[] = []
        // Push headers
        csvLines.push(headers.join(','))

        worksheet.eachRow((row, rowNumber) => {
          // Skip header row
          if (rowNumber === 1) return

          // Skip example rows
          const itemNameVal = String(row.getCell(1).value || '')
          if (itemNameVal.includes('(ตัวอย่าง)')) return

          const lineValues: string[] = []
          for (let i = 1; i <= headers.length; i++) {
            const cell = row.getCell(i)
            let val = ''
            if (cell.value && typeof cell.value === 'object') {
              // @ts-expect-error - ExcelJS CellValue can be cell formula object
              val = String(cell.value.result || cell.value.text || '')
            } else {
              val = cell.value !== null && cell.value !== undefined ? String(cell.value) : ''
            }
            // Escape double quotes and wrap in quotes to prevent CSV parsing issues
            const escaped = val.replace(/"/g, '""')
            lineValues.push(`"${escaped}"`)
          }
          csvLines.push(lineValues.join(','))
        })

        const csvContent = csvLines.join('\n')
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
    <SectionShell
      title="นำเข้าพัสดุและครุภัณฑ์ด้วยไฟล์ Excel หรือ CSV (Import Items)"
      description="อัปโหลดข้อมูลพัสดุครุภัณฑ์จำนวนมากพร้อมกันโดยอัตโนมัติ โดยระบุชื่อพัสดุ ประเภท แบรนด์ และสถานที่ติดตั้ง"
      icon={<Upload className="h-5 w-5" />}
    >
      <div className="space-y-6">
        {/* Upload Zone */}
        <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center text-center space-y-4">
          {isUploading ? (
            <div className="flex flex-col items-center space-y-2 animate-pulse">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
              <span className="text-xs font-bold text-slate-500">กำลังนำเข้าและบันทึกข้อมูลพัสดุ...</span>
            </div>
          ) : (
            <>
              <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-[28px]">upload_file</span>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">เลือกไฟล์ Excel (.xlsx) หรือ CSV เพื่อนำเข้าข้อมูล</h4>
                <p className="text-xs text-slate-400">ขนาดไฟล์ไม่เกิน 10MB และควรจัดรูปแบบคอลัมน์ให้ตรงตามรูปแบบเทมเพลต</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="h-9 px-4 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>ดาวน์โหลดเทมเพลต (Excel)</span>
                </button>
                <label className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer">
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
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {result.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            )}
            <div className="space-y-1">
              <h5 className="text-xs font-bold">{result.type === 'success' ? 'การนำเข้าสำเร็จ' : 'เกิดข้อผิดพลาดในการนำเข้า'}</h5>
              <p className="text-[11px] leading-relaxed opacity-90">{result.message}</p>
            </div>
          </div>
        )}

        {/* CSV Format Guide */}
        <div className="rounded-xl border border-slate-100 p-6 bg-white space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <FileText className="h-4 w-4 text-blue-600" />
            <h4 className="text-xs font-bold">โครงสร้างไฟล์ CSV ที่ระบบแนะนำ (CSV Column Schema)</h4>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            แถวแรกของไฟล์ CSV (Header Row) จะต้องประกอบด้วยชื่อหัวข้อคอลัมน์ต่อไปนี้ (พิมพ์ภาษาอังกฤษพิมพ์เล็ก):
          </p>

          <div className="overflow-x-auto rounded-lg border border-slate-100 mt-2">
            <table className="w-full text-left text-[11px] border-collapse bg-slate-50/30">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-bold">
                  <th className="p-2 border-r border-slate-100">หัวข้อคอลัมน์ (Header)</th>
                  <th className="p-2 border-r border-slate-100">ข้อมูลที่รองรับ</th>
                  <th className="p-2">ตัวอย่างข้อมูล</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 border-r border-slate-100 font-mono text-[10px] text-blue-600">item_name</td>
                  <td className="p-2 border-r border-slate-100">ชื่อสิ่งของ/พัสดุครุภัณฑ์ (จำเป็น)</td>
                  <td className="p-2">เครื่องคอมพิวเตอร์พกพา MacBook Air</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 border-r border-slate-100 font-mono text-[10px] text-blue-600">item_type</td>
                  <td className="p-2 border-r border-slate-100">ประเภทสิ่งของ: asset (ครุภัณฑ์) / material (วัสดุสิ้นเปลือง)</td>
                  <td className="p-2">asset</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 border-r border-slate-100 font-mono text-[10px] text-blue-600">quantity</td>
                  <td className="p-2 border-r border-slate-100">จำนวนพัสดุครุภัณฑ์ (ตัวเลขจำนวนเต็ม)</td>
                  <td className="p-2">1</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 border-r border-slate-100 font-mono text-[10px] text-blue-600">unit_price</td>
                  <td className="p-2 border-r border-slate-100">ราคาต่อหน่วย ใช้คำนวณมูลค่าในรายงาน (ไม่บังคับ)</td>
                  <td className="p-2">35900</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 border-r border-slate-100 font-mono text-[10px] text-blue-600">brand</td>
                  <td className="p-2 border-r border-slate-100">ยี่ห้อ/แบรนด์</td>
                  <td className="p-2">Apple</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 border-r border-slate-100 font-mono text-[10px] text-blue-600">model</td>
                  <td className="p-2 border-r border-slate-100">รุ่นสินค้า</td>
                  <td className="p-2">M2 (2022)</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 border-r border-slate-100 font-mono text-[10px] text-blue-600">asset_no</td>
                  <td className="p-2 border-r border-slate-100">รหัสเลขครุภัณฑ์ (เฉพาะครุภัณฑ์)</td>
                  <td className="p-2">CAMMS-AS-9872</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 border-r border-slate-100 font-mono text-[10px] text-blue-600">serial_no</td>
                  <td className="p-2 border-r border-slate-100">รหัสซีเรียลนัมเบอร์สินค้า (SN)</td>
                  <td className="p-2">C02H20YQ088G</td>
                </tr>
                <tr className="hover:bg-slate-50/50">
                  <td className="p-2 border-r border-slate-100 font-mono text-[10px] text-blue-600">status</td>
                  <td className="p-2 border-r border-slate-100">สถานะ: active / spare / damaged / waiting_repair</td>
                  <td className="p-2">active</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionShell>
  )
}
