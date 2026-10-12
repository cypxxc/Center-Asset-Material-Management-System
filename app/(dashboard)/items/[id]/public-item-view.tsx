'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  LogIn,
  MapPin,
  Package,
  Tag,
  Building2,
  User,
  Info,
  DollarSign,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Share2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ZoomableImage } from '@/components/ui/zoomable-image'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '@/features/items/types'
import type { ItemDetail, ItemStatus } from '@/features/items/types'

interface PublicItemViewProps {
  item: ItemDetail
}

const STATUS_CONFIG: Record<
  ItemStatus,
  { label: string; bgClass: string; textClass: string; dotClass: string; ringClass: string }
> = {
  active: {
    label: ITEM_STATUS_LABELS.active,
    bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    textClass: 'text-emerald-700',
    dotClass: 'bg-emerald-500 animate-pulse',
    ringClass: 'ring-emerald-500/20',
  },
  spare: {
    label: ITEM_STATUS_LABELS.spare,
    bgClass: 'bg-sky-50 text-sky-700 border-sky-200/80',
    textClass: 'text-sky-700',
    dotClass: 'bg-sky-500',
    ringClass: 'ring-sky-500/20',
  },
  waiting_repair: {
    label: ITEM_STATUS_LABELS.waiting_repair,
    bgClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
    textClass: 'text-amber-700',
    dotClass: 'bg-amber-500',
    ringClass: 'ring-amber-500/20',
  },
  damaged: {
    label: ITEM_STATUS_LABELS.damaged,
    bgClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
    textClass: 'text-rose-700',
    dotClass: 'bg-rose-500',
    ringClass: 'ring-rose-500/20',
  },
  inactive: {
    label: ITEM_STATUS_LABELS.inactive,
    bgClass: 'bg-slate-100 text-slate-700 border-slate-200',
    textClass: 'text-slate-600',
    dotClass: 'bg-slate-400',
    ringClass: 'ring-slate-400/20',
  },
  disposed: {
    label: ITEM_STATUS_LABELS.disposed,
    bgClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    textClass: 'text-zinc-600',
    dotClass: 'bg-zinc-400',
    ringClass: 'ring-zinc-400/20',
  },
}

function CopyableCodePill({
  label,
  value,
  highlight = false,
}: {
  label: string
  value?: string | null
  highlight?: boolean
}) {
  const [copied, setCopied] = useState(false)

  if (!value) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback or ignore
    }
  }

  return (
    <div
      className={`group flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
        highlight
          ? 'bg-blue-50/70 border-blue-200 text-blue-950'
          : 'bg-slate-50/90 border-slate-200/80 text-slate-900'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase flex items-center gap-1.5">
          <Tag className="h-3 w-3 text-slate-400" />
          <span>{label}</span>
        </div>
        <div className="mt-0.5 font-mono text-sm sm:text-base font-bold tracking-tight truncate select-all">
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`คัดลอก ${label}`}
        title={`คัดลอก ${label}`}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors shrink-0 cursor-pointer active:scale-95"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-emerald-700 text-[11px]">คัดลอกแล้ว</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700" />
            <span className="text-[11px]">คัดลอก</span>
          </>
        )}
      </button>
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  subvalue,
}: {
  icon: React.ReactNode
  label: string
  value?: string | number | null
  subvalue?: string | null
}) {
  return (
    <div className="p-3.5 rounded-xl border border-slate-200/70 bg-white shadow-2xs flex items-start gap-3">
      <div className="p-2 rounded-lg bg-slate-100/90 text-slate-600 shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          {label}
        </div>
        <div className="mt-0.5 text-sm font-bold text-slate-900 break-words leading-snug">
          {value || '-'}
        </div>
        {subvalue && (
          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
            {subvalue}
          </div>
        )}
      </div>
    </div>
  )
}

export function PublicItemView({ item }: PublicItemViewProps) {
  const [copiedShare, setCopiedShare] = useState(false)
  const brandModel = [item.brand, item.model].filter(Boolean).join(' / ')
  const statusInfo = STATUS_CONFIG[item.status] || {
    label: ITEM_STATUS_LABELS[item.status] || item.status,
    bgClass: 'bg-slate-100 text-slate-800 border-slate-200',
    textClass: 'text-slate-800',
    dotClass: 'bg-slate-500',
    ringClass: 'ring-slate-500/20',
  }

  const handleShare = async () => {
    if (typeof window === 'undefined') return
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.item_name,
          text: `ข้อมูลครุภัณฑ์: ${item.item_name} (${item.asset_no || item.serial_no || ''})`,
          url,
        })
        return
      } catch {
        // User cancelled or share failed, fallback to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopiedShare(true)
      setTimeout(() => setCopiedShare(false), 2000)
    } catch {
      // Ignored
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-100/70 p-3 sm:p-6 md:p-10 flex flex-col items-center justify-start antialiased text-slate-900">
      <main className="w-full max-w-2xl space-y-4 sm:space-y-5">
        
        {/* Top Official Banner with Passport Verification Badge */}
        <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white p-5 sm:p-6 shadow-xl border border-slate-800">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-white/10 rounded-xl text-emerald-400 border border-white/15 backdrop-blur-md shadow-inner">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                    CAMMS — ระบบบริหารจัดการทรัพย์สิน
                  </h1>
                </div>
                <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>ข้อมูลพัสดุและครุภัณฑ์ทางการ (ตรวจสอบผ่าน QR Code)</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleShare}
                aria-label="แชร์ลิงก์ข้อมูลนี้"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold border border-white/10 transition-colors cursor-pointer"
              >
                {copiedShare ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>คัดลอกลิงก์แล้ว</span>
                  </>
                ) : (
                  <>
                    <Share2 className="h-3.5 w-3.5" />
                    <span>แชร์</span>
                  </>
                )}
              </button>

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>อ่านอย่างเดียว (Public)</span>
              </span>
            </div>
          </div>
        </header>

        {/* Hero Card / Passport Information */}
        <section aria-label="ข้อมูลพัสดุและครุภัณฑ์" className="bg-white rounded-2xl border border-slate-200/90 shadow-xl overflow-hidden p-5 sm:p-7 space-y-6">
          
          {/* Header Title & Status Badge */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-5">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wider uppercase bg-blue-50 text-blue-700 border border-blue-200">
                  <Layers className="h-3 w-3" />
                  {ITEM_TYPE_LABELS[item.item_type]}
                </span>
                {item.category?.name && (
                  <span className="text-xs font-medium text-slate-500">
                    • {item.category.name}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight tracking-tight break-words">
                {item.item_name}
              </h2>
            </div>

            {/* Status Pill with Visual Indicator */}
            <div className="self-start sm:self-auto shrink-0">
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold shadow-2xs ${statusInfo.bgClass}`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${statusInfo.dotClass}`} />
                <span>สถานะ: {statusInfo.label}</span>
              </div>
            </div>
          </div>

          {/* Quick-Access Identification Code Box (Asset No & Serial No) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <CopyableCodePill label="เลขครุภัณฑ์" value={item.asset_no} highlight />
            <CopyableCodePill label="Serial Number" value={item.serial_no} />
          </div>

          {/* Item Photo Showcase */}
          {item.image_url ? (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                <span>รูปภาพครุภัณฑ์ประจำทะเบียน</span>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-200 aspect-video sm:aspect-16/9 bg-slate-50 relative shadow-inner group">
                <ZoomableImage
                  src={item.image_url}
                  alt={item.item_name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                />
              </div>
            </div>
          ) : null}

          {/* Key Attributes Grid */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              ข้อมูลจำเพาะและสถานที่จัดเก็บ
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <StatTile
                icon={<Building2 className="h-4 w-4" />}
                label="หมวดหมู่"
                value={item.category?.name}
              />
              <StatTile
                icon={<MapPin className="h-4 w-4 text-rose-500" />}
                label="สถานที่จัดเก็บ"
                value={item.location?.name}
              />
              <StatTile
                icon={<Info className="h-4 w-4" />}
                label="ยี่ห้อ / รุ่น"
                value={brandModel || '-'}
              />
              <StatTile
                icon={<User className="h-4 w-4" />}
                label="ผู้รับผิดชอบ"
                value={item.responsible_person}
              />
              <StatTile
                icon={<Package className="h-4 w-4" />}
                label="จำนวนคงเหลือ"
                value={`${item.quantity} ${item.unit?.name ?? ''}`}
              />
              <StatTile
                icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
                label="ราคาต่อหน่วย"
                value={item.unit_price == null ? null : `${item.unit_price.toLocaleString('th-TH')} บาท`}
              />
            </div>
          </div>

          {/* Notes Card */}
          {item.note && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-slate-400" />
                <span>หมายเหตุ</span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                {item.note}
              </p>
            </div>
          )}

          {/* Verification Timestamp */}
          <div className="pt-1 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-100">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>ปรับปรุงข้อมูลล่าสุด:</span>
            </span>
            <span className="font-medium text-slate-600">
              {item.updated_at
                ? new Date(item.updated_at).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '-'}
            </span>
          </div>

          {/* Staff Login CTA Banner */}
          <div className="pt-5 border-t border-slate-150 flex flex-col items-center justify-center space-y-2.5 bg-slate-50/70 -mx-5 sm:-mx-7 -mb-5 sm:-mb-7 p-6 rounded-b-2xl">
            <div className="text-center">
              <p className="text-xs sm:text-sm font-bold text-slate-800">
                คุณเป็นเจ้าหน้าที่ผู้ดูแลพัสดุใช่หรือไม่?
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                เข้าสู่ระบบเพื่อแก้ไขข้อมูล ตรวจนับทางกายภาพ หรือจัดการสถานะครุภัณฑ์นี้
              </p>
            </div>
            
            <Link
              href={`/login?next=/items/${item.id}`}
              className="w-full sm:w-auto"
            >
              <Button
                type="button"
                className="w-full sm:w-auto h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <LogIn className="h-4 w-4" />
                <span>เข้าสู่ระบบเพื่อจัดการ (สำหรับเจ้าหน้าที่)</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </Link>
          </div>

        </section>

        {/* Footer Credit */}
        <footer className="text-center py-2 text-[11px] text-slate-400">
          ระบบบริหารจัดการทรัพย์สินและพัสดุส่วนกลาง (CAMMS)
        </footer>
      </main>
    </div>
  )
}
