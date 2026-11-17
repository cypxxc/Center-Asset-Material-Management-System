'use client'

import { useEffect, type ReactNode } from 'react'
import { Copy, Package, X } from 'lucide-react'
import { ZoomableImage } from '@/components/ui/zoomable-image'
import { type ItemListRow } from '@/features/items/types'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatDateThaiBE } from '@/lib/date'
import { AssetRegisterDetails } from './asset-register-details'

export interface InspectorProps {
 isOpen: boolean
 onClose: () => void
 item: ItemListRow | null
 onCopy?: (value: string | null | undefined) => void
 mode?: 'docked' | 'drawer' | 'auto'
}

export function Inspector({
 isOpen,
 onClose,
 item,
 onCopy,
 mode = 'auto',
}: InspectorProps) {
 const isDesktop = useMediaQuery('(min-width: 1024px)', false)
 const resolvedMode = mode === 'auto' ? (isDesktop ? 'docked' : 'drawer') : mode

 useEffect(() => {
 if (!isOpen) return
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === 'Escape') {
 onClose()
 }
 }
 window.addEventListener('keydown', handleKeyDown)
 return () => window.removeEventListener('keydown', handleKeyDown)
 }, [isOpen, onClose])

 if (!isOpen || !item) {
 return null
 }

 const handleCopy = (value: string | null | undefined) => {
 if (onCopy) {
 onCopy(value)
 return
 }
 if (value && typeof navigator !== 'undefined') {
 navigator.clipboard?.writeText(value).catch(() => {})
 }
 }

 const content = (
 <>
 {/* Header */}
 <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-5 sm:py-4 min-w-0">
 <div className="flex flex-col min-w-0 pr-2">
 <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.item_type === 'material' ? 'รายละเอียดวัสดุ' : 'รายละเอียดสิ่งของ'}</span>
 <h3 className="truncate text-sm sm:text-base font-extrabold text-card-foreground" title={item.item_name}>{item.item_name}</h3>
 </div>
 <button
 type="button"
 onClick={onClose}
 className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
 aria-label="ปิดแถบรายละเอียด"
 >
 <X className="h-4 w-4" />
 </button>
 </div>

 {/* Scrollable Content */}
 <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
 {/* Image preview */}
 <div className="relative h-44 sm:h-52 shrink-0 overflow-hidden border-b border-border bg-muted">
 {item.image_url ? (
 <ZoomableImage
 src={item.image_url}
 alt={item.item_name}
 className="h-full w-full"
 imgClassName="h-full w-full object-cover"
 />
 ) : (
 <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
 <Package className="h-12 w-12 stroke-[1.25] text-muted-foreground/50" />
 <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">No Image Available</span>
 </div>
 )}

 </div>

 <div className="flex flex-col gap-3.5 p-4 sm:p-5">
 {/* Title card */}
 <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 shadow-2xs min-w-0">
 <div className="flex items-start justify-between gap-2 min-w-0">
 <h4 className="text-sm sm:text-base font-extrabold leading-tight text-card-foreground break-words min-w-0 flex-1">{item.item_name}</h4>
 </div>
 </div>

 {/* SECTION 1: ประเภทและสถานะเกณฑ์ (Tone Emerald) */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 min-w-0">
 <InspectorBox tone="emerald" label="ประเภทสิ่งของ">
 <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-bold text-card-foreground truncate">
 {item.item_type === 'asset' ? 'ครุภัณฑ์ (Asset)' : 'วัสดุ (Material)'}
 </div>
 </InspectorBox>

 {item.item_type !== 'material' && <InspectorBox
 tone="emerald"
 label="สถานะเกณฑ์"
 >
 <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-bold text-card-foreground truncate">
 {item.qualification_status === 'qualified'
 ? 'ตามเกณฑ์'
 : item.qualification_status === 'below_threshold'
 ? 'ต่ำกว่าเกณฑ์ (ต.)'
 : 'ยังไม่ระบุ'}
 </div>
 </InspectorBox>}
 </div>

 {/* SECTION 2: ข้อมูลระบุตัวตน (Tone Blue) */}
 {item.item_type === 'asset' && <AssetRegisterDetails item={item} />}
 {item.material && <>
 <InspectorBox tone="blue" label="รหัสวัสดุ"><p className="break-all font-mono text-xs">{item.material.commodity_code || '—'}</p></InspectorBox>
 <InspectorBox tone="violet" label="ขนาดหรือลักษณะ"><p className="whitespace-pre-wrap break-words text-xs">{item.material.specification || '—'}</p></InspectorBox>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 {([
 ['จำนวนอย่างต่ำ', item.material.minimum_quantity], ['จำนวนอย่างสูง', item.material.maximum_quantity],
 ['ยอดยกมา — จำนวน', item.material.opening_quantity], ['ยอดยกมา — บาท', item.material.opening_amount],
 ['รับ — จำนวน', item.material.received_quantity], ['รับ — บาท', item.material.received_amount],
 ['จ่าย — จำนวน', item.material.issued_quantity], ['จ่าย — บาท', item.material.issued_amount],
 ['จำนวนเงินตามบัญชี (บาท)', item.material.balance_amount], ['ปีงบประมาณ พ.ศ.', item.material.fiscal_year],
 ] as const).map(([label, value]) => <InspectorBox key={label} tone="teal" label={label}><p className="text-xs tabular-nums">{value == null ? '—' : Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 })}</p></InspectorBox>)}
 </div>
 <InspectorBox tone="teal" label="วันที่ยอดตามบัญชี"><p className="text-xs">{item.material.balance_as_of ? formatDateThaiBE(item.material.balance_as_of) : '—'}</p></InspectorBox>
 </>}
 {item.asset_no && (
 <InspectorBox tone="blue" label={item.item_type === 'material' ? 'เลขทะเบียนวัสดุ' : 'เลขครุภัณฑ์'}>
 <div className="flex items-center justify-between gap-2 min-w-0">
 <p className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs font-bold text-card-foreground min-w-0 flex-1" title={item.asset_no}>
 {item.asset_no}
 </p>
 <button
 type="button"
 onClick={() => handleCopy(item.asset_no)}
 className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary cursor-pointer shrink-0"
 title="คัดลอกเลขครุภัณฑ์"
 aria-label="คัดลอกเลขครุภัณฑ์"
 >
 <Copy className="h-3.5 w-3.5" />
 </button>
 </div>
 </InspectorBox>
 )}

 {item.serial_no && (
 <InspectorBox tone="blue" label="Serial Number">
 <div className="flex items-center justify-between gap-2 min-w-0">
 <p className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs font-bold text-card-foreground min-w-0 flex-1" title={item.serial_no}>
 {item.serial_no}
 </p>
 <button
 type="button"
 onClick={() => handleCopy(item.serial_no)}
 className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary cursor-pointer shrink-0"
 title="คัดลอก Serial Number"
 aria-label="คัดลอก Serial Number"
 >
 <Copy className="h-3.5 w-3.5" />
 </button>
 </div>
 </InspectorBox>
 )}

 {!item.material && !item.asset_no && !item.serial_no && (
 <InspectorBox tone="blue" label="เลขอ้างอิง">
 <p className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs text-muted-foreground min-w-0">
 - ไม่มีเลขอ้างอิง -
 </p>
 </InspectorBox>
 )}

 {/* SECTION 3: คุณลักษณะและยี่ห้อ (Tone Violet) */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 min-w-0">
 {(item.brand || item.model) ? (
 <InspectorBox tone="violet" label="ยี่ห้อ / รุ่น">
 <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground truncate" title={[item.brand, item.model].filter(Boolean).join(' - ')}>
 {[item.brand, item.model].filter(Boolean).join(' - ') || '-'}
 </div>
 </InspectorBox>
 ) : null}

 <InspectorBox tone="violet" label="จำนวนคงเหลือ">
 <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-bold text-card-foreground truncate">
 {item.quantity} {item.unit?.name ?? ''}
 </div>
 </InspectorBox>
 </div>

 {/* SECTION 4: มูลค่าและงบประมาณ (Tone Teal) */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 min-w-0">
 <InspectorBox tone="teal" label="ราคาต่อหน่วย">
 <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-bold text-card-foreground truncate">
 {item.unit_price !== null && item.unit_price !== undefined ? `฿${item.unit_price.toLocaleString()}` : '-'}
 </div>
 </InspectorBox>

 {item.gfmis_number ? (
 <InspectorBox tone="teal" label="เลขสินทรัพย์ (GFMIS)">
 <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 font-mono text-xs font-semibold text-card-foreground truncate" title={item.gfmis_number}>
 {item.gfmis_number}
 </div>
 </InspectorBox>
 ) : null}

 {item.budget_source ? (
 <InspectorBox tone="teal" label="รับจาก (งปม.)">
 <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground truncate" title={item.budget_source}>
 {item.budget_source}
 </div>
 </InspectorBox>
 ) : null}

 {item.acquired_date ? (
 <InspectorBox tone="teal" label="วันที่รับเข้า">
 <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground truncate">
 {formatDateThaiBE(item.acquired_date)}
 </div>
 </InspectorBox>
 ) : null}
 </div>

 {/* SECTION 5: สถานที่และการครอบครอง (Tone Indigo) */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 min-w-0">
 <InspectorBox tone="indigo" label="สถานที่จัดเก็บ">
 <div className="rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground truncate" title={item.location?.name}>
 {item.location?.name || 'ไม่ได้ระบุ'}
 </div>
 </InspectorBox>

 <InspectorBox tone="indigo" label="ผู้รับผิดชอบ">
 <div className="flex items-center rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs font-medium text-card-foreground min-w-0">
 <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs font-bold text-indigo-600 ">
 {(item.responsible_person || 'U').charAt(0).toUpperCase()}
 </div>
 <span className="font-bold text-card-foreground truncate flex-1 min-w-0" title={item.responsible_person || 'ยังไม่มีผู้รับผิดชอบ'}>
 {item.responsible_person || 'ยังไม่มีผู้รับผิดชอบ'}
 </span>
 </div>
 </InspectorBox>
 </div>

 {/* SECTION 6: หมายเหตุ (Tone Slate) */}
 <InspectorBox tone="slate" label={item.item_type === 'material' ? 'หมายเหตุ' : 'รายละเอียดเพิ่มเติม'}>
 <p className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-2 sm:p-2.5 text-xs leading-relaxed text-muted-foreground break-words min-w-0">
 {item.item_type === 'material' ? 'ส่วนกลาง' : item.note || '- ไม่มีหมายเหตุ -'}
 </p>
 </InspectorBox>
 </div>
 </div>

 </>
 )

 if (resolvedMode === 'docked') {
 return (
 <aside
 className="w-[340px] xl:w-[380px] 2xl:w-[420px] max-w-[45%] shrink-0 border-l border-border bg-card flex flex-col h-full overflow-hidden transition-all duration-200 z-20"
 aria-label="รายละเอียดรายการ"
 role="region"
 data-testid="inspector-panel"
 data-mode="docked"
 >
 {content}
 </aside>
 )
 }

 return (
 <>
 {/* Backdrop */}
 <div
 className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
 onClick={onClose}
 aria-hidden="true"
 data-testid="inspector-backdrop"
 />

 {/* Drawer Panel */}
 <aside
 className="fixed inset-y-0 right-0 z-50 flex w-full sm:max-w-[460px] flex-col border-l border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-right duration-250"
 aria-label="รายละเอียดรายการ"
 role="dialog"
 aria-modal="true"
 data-testid="inspector-panel"
 data-mode="drawer"
 >
 {content}
 </aside>
 </>
 )
}

function InspectorBox({
 label,
 children,
 tone = 'default',
}: {
 label: string
 children: ReactNode
 tone?: 'blue' | 'violet' | 'teal' | 'indigo' | 'slate' | 'emerald' | 'default'
}) {
 const toneLabelClasses = {
 blue: 'text-blue-600 ',
 emerald: 'text-emerald-600 ',
 violet: 'text-violet-600 ',
 teal: 'text-teal-600 ',
 indigo: 'text-indigo-600 ',
 slate: 'text-slate-600 ',
 default: 'text-primary',
 }

 return (
 <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs min-w-0">
 <p className={`mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${toneLabelClasses[tone]} min-w-0`}>
 <span className="truncate">{label}</span>
 </p>
 {children}
 </div>
 )
}
