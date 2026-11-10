import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Edit,
  Tag,
  Building2,
  MapPin,
  User,
  DollarSign,
  Package,
  Layers,
  Sparkles,
  Calculator,
  Boxes,
  Calendar,
  Receipt,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeleteItemButton } from '@/features/items/components/delete-item-button'
import { getItemDetailPageData } from '@/features/items/queries'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '@/features/items/types'
import type { ItemStatus } from '@/features/items/types'
import { getCurrentProfile } from '@/features/auth/queries'
import { canWrite, canDelete } from '@/lib/permissions'

import { ZoomableImage } from '@/components/ui/zoomable-image'
import { ItemAuditTimeline } from './item-audit-timeline'
import { ItemDetailActions } from './item-detail-actions'
import { ItemAuditCheckin } from './item-audit-checkin'
import { PublicItemView } from './public-item-view'
import { calculateStraightLineDepreciation } from '@/features/depreciation/calculation'

interface ItemDetailPageProps {
  params: Promise<{
    id: string
  }>
}

const STATUS_CONFIG: Record<
  ItemStatus,
  { label: string; bgClass: string; dotClass: string }
> = {
  active: {
    label: ITEM_STATUS_LABELS.active,
    bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    dotClass: 'bg-emerald-500 animate-pulse',
  },
  spare: {
    label: ITEM_STATUS_LABELS.spare,
    bgClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
    dotClass: 'bg-sky-500',
  },
  waiting_repair: {
    label: ITEM_STATUS_LABELS.waiting_repair,
    bgClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    dotClass: 'bg-amber-500',
  },
  damaged: {
    label: ITEM_STATUS_LABELS.damaged,
    bgClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
    dotClass: 'bg-rose-500',
  },
  inactive: {
    label: ITEM_STATUS_LABELS.inactive,
    bgClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
  },
  disposed: {
    label: ITEM_STATUS_LABELS.disposed,
    bgClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    dotClass: 'bg-zinc-400',
  },
}

function SectionHeaderBadge({
  tone,
  icon,
  title,
  description,
}: {
  tone: 'blue' | 'violet' | 'teal' | 'indigo' | 'slate'
  icon: React.ReactNode
  title: string
  description?: string
}) {
  const toneClasses = {
    blue: 'border-blue-200/80 bg-blue-50/90 text-blue-700 dark:border-blue-800/70 dark:bg-blue-950/40 dark:text-blue-300',
    violet: 'border-violet-200/80 bg-violet-50/90 text-violet-700 dark:border-violet-800/70 dark:bg-violet-950/40 dark:text-violet-300',
    teal: 'border-teal-200/80 bg-teal-50/90 text-teal-700 dark:border-teal-800/70 dark:bg-teal-950/40 dark:text-teal-300',
    indigo: 'border-indigo-200/80 bg-indigo-50/90 text-indigo-700 dark:border-indigo-800/70 dark:bg-indigo-950/40 dark:text-indigo-300',
    slate: 'border-slate-200/80 bg-slate-100 text-slate-700 dark:border-slate-800/70 dark:bg-slate-900/40 dark:text-slate-300',
  }

  return (
    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border/60">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs ${toneClasses[tone]}`}>
          {icon}
          <span>{title}</span>
        </span>
        {description && (
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            {description}
          </span>
        )}
      </div>
    </div>
  )
}

function DetailTile({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon?: React.ReactNode
  label: string
  value?: string | number | null
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-3.5 transition-all ${
        highlight
          ? 'bg-blue-50/60 border-blue-200/90 text-blue-950 dark:bg-blue-950/30 dark:border-blue-800/80 dark:text-blue-200'
          : 'bg-card border-border/70 text-card-foreground hover:border-border dark:bg-card/60'
      }`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm sm:text-base font-bold text-foreground break-words">
        {value || '-'}
      </div>
    </div>
  )
}

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const profilePromise = getCurrentProfile()
  const { id } = await params
  const [profile, { item, auditLogs }] = await Promise.all([
    profilePromise,
    getItemDetailPageData(id),
  ])

  if (!item) notFound()

  if (!profile) {
    return <PublicItemView item={item} />
  }

  const userCanWrite = canWrite(profile.role)
  const userCanDelete = canDelete(profile.role)
  const depreciation = calculateStraightLineDepreciation({
    enabled: item.depreciation_enabled ?? false,
    cost: item.depreciation_cost ?? null,
    usefulLifeYears: item.depreciation_useful_life_years ?? null,
    startDate: item.depreciation_start_date ?? null,
    residualValue: item.depreciation_residual_value ?? 1,
  })

  const statusInfo = STATUS_CONFIG[item.status] || {
    label: ITEM_STATUS_LABELS[item.status] || item.status,
    bgClass: 'bg-slate-100 text-slate-800 border-slate-200',
    dotClass: 'bg-slate-500',
  }

  const latestAudit = auditLogs.find(
    (l) => l.action === 'PHYSICAL_AUDIT' || l.action === 'physical_audit'
  )
  const lastAuditedNote =
    latestAudit?.new_data && typeof latestAudit.new_data === 'object'
      ? ((latestAudit.new_data as Record<string, unknown>).note as string | undefined) ||
        ((latestAudit.new_data as Record<string, Record<string, unknown>>).values?.note as string | undefined)
      : null

  return (
    <div className="h-full overflow-y-auto bg-slate-50/60 p-4 sm:p-6 md:p-8 antialiased">
      <div className="mx-auto max-w-4xl space-y-6">
        
        {/* Navigation & Actions Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <Link href="/items">
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full shadow-2xs hover:bg-white cursor-pointer mt-1 sm:mt-0"
                title="กลับหน้ารายการพัสดุ"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-blue-700 border border-blue-200">
                  <Layers className="h-3 w-3" />
                  {ITEM_TYPE_LABELS[item.item_type]}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${statusInfo.bgClass}`}
                >
                  <span className={`h-2 w-2 rounded-full ${statusInfo.dotClass}`} />
                  <span>{statusInfo.label}</span>
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground mt-1 truncate">
                {item.item_name}
              </h2>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
            {userCanWrite && (
            <ItemDetailActions
              item={{
                id: item.id,
                item_name: item.item_name,
                asset_no: item.asset_no,
                serial_no: item.serial_no,
                brand: item.brand,
                model: item.model,
                location_name: item.location?.name,
                category_name: item.category?.name,
                responsible_person: item.responsible_person,
                unit_price: item.unit_price,
              }}
            />
            )}
            {userCanWrite && (
              <Link href={`/items/${item.id}/edit`}>
                <Button
                  variant="outline"
                  className="font-bold flex items-center gap-1.5 h-10 px-4 shadow-2xs cursor-pointer"
                >
                  <Edit className="h-4 w-4 text-blue-600" />
                  <span>แก้ไข</span>
                </Button>
              </Link>
            )}
            {userCanDelete && <DeleteItemButton id={item.id} />}
          </div>
        </div>

        {/* Physical Inventory Audit Check-in Banner */}
        {userCanWrite && (
        <ItemAuditCheckin
          itemId={item.id}
          itemName={item.item_name}
          lastAuditedAt={latestAudit?.created_at}
          lastAuditedBy={latestAudit?.user_name}
          lastAuditedNote={lastAuditedNote}
        />
        )}

        {/* Main Details and Image Section */}
        <div className={item.image_url ? "grid gap-6 md:grid-cols-[1fr_300px]" : "grid gap-6"}>
          
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-6">
            
            {/* SECTION 1: ข้อมูลระบุตัวตน (Identification) - Tone Blue */}
            <div className="space-y-3">
              <SectionHeaderBadge
                tone="blue"
                icon={<Tag className="h-3.5 w-3.5" />}
                title="1. ข้อมูลระบุตัวตนและหมวดหมู่"
                description="เลขทะเบียนและรหัสอ้างอิง"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailTile
                  icon={<Tag className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                  label={item.item_type === 'material' ? 'เลขทะเบียนพัสดุ (ต.)' : 'เลขครุภัณฑ์'}
                  value={item.asset_no}
                  highlight
                />
                <DetailTile
                  icon={<Tag className="h-3.5 w-3.5 text-slate-500" />}
                  label="Serial Number"
                  value={item.serial_no}
                />
                <DetailTile
                  icon={<Building2 className="h-3.5 w-3.5 text-blue-500" />}
                  label="หมวดหมู่"
                  value={item.category?.name}
                />
                <DetailTile
                  icon={<Layers className="h-3.5 w-3.5 text-blue-500" />}
                  label="ประเภทพัสดุ"
                  value={ITEM_TYPE_LABELS[item.item_type]}
                />
              </div>
            </div>

            {/* SECTION 2: ข้อมูลจำเพาะและยี่ห้อ (Specifications) - Tone Violet */}
            <div className="space-y-3">
              <SectionHeaderBadge
                tone="violet"
                icon={<Boxes className="h-3.5 w-3.5" />}
                title="2. ข้อมูลจำเพาะและคุณลักษณะ"
                description="ยี่ห้อ รุ่น และจำนวนคงเหลือ"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailTile label="ยี่ห้อ" value={item.brand} />
                <DetailTile label="รุ่น" value={item.model} />
                <DetailTile
                  icon={<Package className="h-3.5 w-3.5 text-violet-500" />}
                  label="จำนวนคงเหลือ"
                  value={`${item.quantity} ${item.unit?.name ?? ''}`}
                />
              </div>
            </div>

            {/* SECTION 3: มูลค่าและงบประมาณ (Financial & Budget) - Tone Teal */}
            <div className="space-y-3">
              <SectionHeaderBadge
                tone="teal"
                icon={<DollarSign className="h-3.5 w-3.5" />}
                title="3. ข้อมูลมูลค่าและงบประมาณ"
                description="ราคาต่อหน่วย แหล่งเงิน และประวัติค่าเสื่อม"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailTile
                  icon={<DollarSign className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />}
                  label="ราคาต่อหน่วย"
                  value={item.unit_price == null ? null : `฿${item.unit_price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
                />
                <DetailTile
                  icon={<Receipt className="h-3.5 w-3.5 text-teal-500" />}
                  label="มูลค่ารวมทั้งสิ้น"
                  value={item.unit_price == null ? null : `฿${(item.unit_price * item.quantity).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`}
                />
                {item.gfmis_number && (
                  <DetailTile
                    icon={<Tag className="h-3.5 w-3.5 text-teal-500" />}
                    label="เลขสินทรัพย์ (GFMIS)"
                    value={item.gfmis_number}
                  />
                )}
                {item.budget_source && (
                  <DetailTile
                    icon={<Building2 className="h-3.5 w-3.5 text-teal-500" />}
                    label="รับจาก (งปม.) / แหล่งเงิน"
                    value={item.budget_source}
                  />
                )}
                {item.acquired_date && (
                  <DetailTile
                    icon={<Calendar className="h-3.5 w-3.5 text-teal-500" />}
                    label="วัน เดือน ปีที่รับเข้า"
                    value={item.acquired_date}
                  />
                )}
              </div>

              {/* Depreciation Section */}
              {depreciation && (
                <div className="rounded-xl border border-teal-200/60 bg-teal-50/30 dark:border-teal-800/50 dark:bg-teal-950/20 p-4 space-y-3 mt-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-teal-900 dark:text-teal-300">
                    <Calculator className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span>การคิดค่าเสื่อมราคา (Straight-line)</span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <DetailTile label="วันเริ่มคิด" value={item.depreciation_start_date} />
                    <DetailTile
                      label="มูลค่าพร้อมใช้งาน"
                      value={`${(item.depreciation_cost ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`}
                    />
                    <DetailTile label="อายุการใช้งาน" value={`${item.depreciation_useful_life_years} ปี`} />
                    <DetailTile
                      label="ค่าเสื่อมต่อปี"
                      value={`${depreciation.annualDepreciation.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`}
                    />
                    <DetailTile
                      label="ค่าเสื่อมสะสม ณ วันนี้"
                      value={`${depreciation.accumulatedDepreciation.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`}
                    />
                    <DetailTile
                      label="มูลค่าสุทธิ ณ วันนี้"
                      value={`${depreciation.netBookValue.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`}
                      highlight
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 4: สถานที่และการกำกับดูแล (Location & Custody) - Tone Indigo */}
            <div className="space-y-3">
              <SectionHeaderBadge
                tone="indigo"
                icon={<MapPin className="h-3.5 w-3.5" />}
                title="4. สถานที่และการกำกับดูแล"
                description="สถานที่จัดเก็บและผู้รับผิดชอบ"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailTile
                  icon={<MapPin className="h-3.5 w-3.5 text-indigo-500" />}
                  label="สถานที่จัดเก็บ"
                  value={item.location?.name}
                />
                <DetailTile
                  icon={<User className="h-3.5 w-3.5 text-indigo-500" />}
                  label="ผู้รับผิดชอบ / ผู้ครอบครอง"
                  value={item.responsible_person}
                />
              </div>
            </div>

            {/* SECTION 5: หมายเหตุ (Notes) - Tone Slate */}
            <div className="space-y-3">
              <SectionHeaderBadge
                tone="slate"
                icon={<FileText className="h-3.5 w-3.5" />}
                title="หมายเหตุเพิ่มเติม"
              />
              <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
                <p className="text-sm leading-6 text-foreground/90 whitespace-pre-line">
                  {item.note || 'ไม่มีหมายเหตุ'}
                </p>
              </div>
            </div>
          </div>

          {/* Photo Column */}
          {item.image_url && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col gap-3 h-fit">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                <span>รูปภาพสิ่งของ</span>
              </div>
              <div className="relative rounded-xl overflow-hidden border border-border aspect-square bg-muted/10 shadow-inner group">
                <ZoomableImage
                  src={item.image_url}
                  alt={item.item_name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                />
              </div>
            </div>
          )}
        </div>

        {/* Audit Log Timeline */}
        {profile.role === 'admin' && <ItemAuditTimeline logs={auditLogs} />}
      </div>
    </div>
  )
}
