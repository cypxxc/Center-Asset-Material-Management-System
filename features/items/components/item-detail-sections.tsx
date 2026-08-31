import type { ReactNode } from 'react'
import { Calculator, Clock, Copy, MapPin, Package, StickyNote, Tag } from 'lucide-react'
import { StatusBadge } from '@/components/ui/status-badge'
import { calculateStraightLineDepreciation } from '@/features/depreciation/calculation'
import { ITEM_TYPE_LABELS, type ItemListRow } from '../types'

const tones = {
  blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100',
  violet: 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  amber: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100',
  slate: 'border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
}

function Section({ title, tone, icon, children }: {
  title: string
  tone: keyof typeof tones
  icon: ReactNode
  children: ReactNode
}) {
  return <section aria-label={title} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
    <div className={`flex items-center gap-2.5 border-b px-4 py-3 ${tones[tone]}`}>
      <span aria-hidden="true">{icon}</span>
      <h4 className="text-sm font-bold">{title}</h4>
    </div>
    <div className="p-4">{children}</div>
  </section>
}

function Field({ label, children, wide = false }: { label: string; children?: ReactNode; wide?: boolean }) {
  return <div className={`min-w-0 ${wide ? 'col-span-full' : ''}`}>
    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
    <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-relaxed text-card-foreground [overflow-wrap:anywhere]">
      {children === null || children === undefined || children === '' ? 'ไม่ได้ระบุ' : children}
    </dd>
  </div>
}

function dateLabel(value?: string | null, withTime = false) {
  if (!value) return null
  const date = new Date(value.length === 10 ? `${value}T00:00:00+07:00` : value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' as const } : {}), timeZone: 'Asia/Bangkok',
  }).format(date)
}

const money = (value: number) => `${value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
const startLabels = { acquired: 'วันที่ได้มา', available: 'วันที่พร้อมใช้งาน', manual: 'กำหนดวันเอง' }

export function ItemDetailSections({ item, onCopy }: {
  item: ItemListRow
  onCopy?: (value: string | null | undefined) => void
}) {
  const depreciation = calculateStraightLineDepreciation({
    enabled: item.depreciation_enabled ?? false,
    cost: item.depreciation_cost ?? null,
    usefulLifeYears: item.depreciation_useful_life_years ?? null,
    startDate: item.depreciation_start_date ?? null,
    residualValue: item.depreciation_residual_value ?? 1,
  })
  const reference = (label: string, value: string | null) => <Field label={label} wide>
    {value ? <span className="flex items-start gap-2">
      <span className="min-w-0 flex-1 font-mono">{value}</span>
      {onCopy && <button type="button" onClick={() => onCopy(value)} aria-label={`คัดลอก${label}`}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Copy className="h-4 w-4" />
      </button>}
    </span> : null}
  </Field>

  return <div className="space-y-4">
    <Section title="ข้อมูลหลัก" tone="blue" icon={<Package className="h-4 w-4" />}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Field label="ชื่อสิ่งของ" wide>{item.item_name}</Field>
        <Field label="ประเภท">{ITEM_TYPE_LABELS[item.item_type]}</Field>
        <Field label="หมวดหมู่">{item.category?.name}</Field>
        <Field label="จำนวนคงเหลือ">{`${item.quantity.toLocaleString('th-TH')} ${item.unit?.name ?? ''}`.trim()}</Field>
        <Field label="หน่วยนับ">{item.unit?.name}</Field>
      </dl>
    </Section>
    <Section title="ทะเบียนและราคา" tone="violet" icon={<Tag className="h-4 w-4" />}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        {reference('เลขครุภัณฑ์', item.asset_no)}
        {reference('Serial Number', item.serial_no)}
        <Field label="ยี่ห้อ">{item.brand}</Field>
        <Field label="รุ่น">{item.model}</Field>
        <Field label="ราคาต่อหน่วย">{item.unit_price == null ? null : `฿${item.unit_price.toLocaleString('th-TH')}`}</Field>
        <Field label="มูลค่ารวม (จำนวน × ราคา)">{item.unit_price == null ? null : money(item.quantity * item.unit_price)}</Field>
      </dl>
    </Section>
    <Section title="สถานที่และผู้รับผิดชอบ" tone="emerald" icon={<MapPin className="h-4 w-4" />}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Field label="สถานที่จัดเก็บ" wide>{item.location?.name}</Field>
        <Field label="ผู้รับผิดชอบ" wide>{item.responsible_person}</Field>
        <Field label="สถานะปัจจุบัน" wide><StatusBadge status={item.status} size="lg" className="dark:text-slate-100" /></Field>
      </dl>
    </Section>
    {item.item_type === 'asset' && <Section title="การคิดค่าเสื่อมราคา" tone="amber" icon={<Calculator className="h-4 w-4" />}>
      {item.depreciation_enabled ? <>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <Field label="วิธีคิด" wide>เส้นตรง (Straight-line)</Field>
          <Field label="มูลค่าพร้อมใช้งาน">{item.depreciation_cost == null ? null : money(item.depreciation_cost)}</Field>
          <Field label="อายุการใช้งาน">{item.depreciation_useful_life_years == null ? null : `${item.depreciation_useful_life_years} ปี`}</Field>
          <Field label="อ้างอิงวันเริ่มคิด">{item.depreciation_start_basis ? startLabels[item.depreciation_start_basis] : null}</Field>
          <Field label="วันเริ่มคิดค่าเสื่อม">{dateLabel(item.depreciation_start_date)}</Field>
          <Field label="มูลค่าคงเหลือ">{money(item.depreciation_residual_value ?? 1)}</Field>
          {depreciation && <>
            <Field label="ค่าเสื่อมต่อปี">{money(depreciation.annualDepreciation)}</Field>
            <Field label="ค่าเสื่อมสะสม ณ วันนี้">{money(depreciation.accumulatedDepreciation)}</Field>
            <Field label="มูลค่าสุทธิ ณ วันนี้">{money(depreciation.netBookValue)}</Field>
          </>}
        </dl>
        {!depreciation && <p className="mt-4 text-sm text-muted-foreground">ข้อมูลสำหรับคำนวณค่าเสื่อมยังไม่ครบหรือไม่ถูกต้อง</p>}
        <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          สูตร: ค่าเสื่อมต่อปี = (มูลค่าพร้อมใช้งาน − มูลค่าคงเหลือ) ÷ อายุการใช้งาน (ปี)
        </p>
      </> : <p className="text-sm text-muted-foreground">ไม่ได้เปิดใช้งานการคิดค่าเสื่อมราคา</p>}
    </Section>}
    <Section title="หมายเหตุ" tone="slate" icon={<StickyNote className="h-4 w-4" />}>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-card-foreground [overflow-wrap:anywhere]">{item.note || 'ไม่มีหมายเหตุ'}</p>
    </Section>
    <Section title="ข้อมูลการบันทึก" tone="slate" icon={<Clock className="h-4 w-4" />}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Field label="วันที่สร้างรายการ">{dateLabel(item.created_at, true)}</Field>
        <Field label="แก้ไขล่าสุด">{dateLabel(item.updated_at, true)}</Field>
      </dl>
    </Section>
  </div>
}
