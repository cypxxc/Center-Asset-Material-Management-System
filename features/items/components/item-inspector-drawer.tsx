'use client'

import { useState, useEffect, type ReactNode } from 'react'
import {
  Copy,
  Package,
  X,
  Check,
  ChevronDown,
  Info,
  Tag,
  Layers,
  DollarSign,
  MapPin,
  FileText,
} from 'lucide-react'
import { ZoomableImage } from '@/components/ui/zoomable-image'
import { type ItemListRow } from '@/features/items/types'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatDateThaiBE } from '@/lib/date'
import { AssetRegisterDetails } from './asset-register-details'
import { TruncatedTextTooltip } from '@/components/ui/truncated-text-tooltip'
import { cn } from '@/lib/utils'

export interface InspectorProps {
  isOpen: boolean
  onClose: () => void
  item: ItemListRow | null
  onCopy?: (value: string | null | undefined) => void
  mode?: 'docked' | 'drawer' | 'auto'
  onOpenDetails?: () => void
  userCanWrite?: boolean
  userCanDelete?: boolean
  onPrint?: () => void
  onEdit?: () => void
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

  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [isLedgerOpen, setIsLedgerOpen] = useState(true)
  const [isAdditionalOpen, setIsAdditionalOpen] = useState(false)

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

  const handleCopy = (field: string, value: string | null | undefined) => {
    if (onCopy) {
      onCopy(value)
    } else if (value && typeof navigator !== 'undefined') {
      navigator.clipboard?.writeText(value).catch(() => {})
    }
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 1500)
  }

  const hasAssetRegisterData = Boolean(
    item.register_sequence ||
    item.asset_prefix ||
    item.register_accumulated_depreciation != null ||
    item.register_book_value != null ||
    item.register_as_of
  )

  const hasGeneralInfo = Boolean(
    (item.brand || item.model) ||
    (item.item_type === 'asset' && item.serial_no) ||
    item.category?.name ||
    item.unit?.name
  )

  const hasFinancialInfo = Boolean(
    item.unit_price != null ||
    (item.register_book_value != null && item.register_book_value !== item.unit_price) ||
    item.gfmis_number ||
    item.budget_source
  )

  const unfilledItems: [string, string][] = []
  if (item.item_type === 'asset') {
    if (!item.brand && !item.model) unfilledItems.push(['ยี่ห้อ / รุ่น', 'ไม่ระบุ'])
    if (!item.serial_no) unfilledItems.push(['Serial Number', 'ไม่ระบุ'])
    if (!item.gfmis_number) unfilledItems.push(['เลขสินทรัพย์ (GFMIS)', 'ไม่ระบุ'])
    if (!item.budget_source) unfilledItems.push(['รับจาก (งปม.)', 'ไม่ระบุ'])
    if (!item.acquired_date) unfilledItems.push(['วันที่ได้มา', 'ไม่ระบุ'])
    if (!item.responsible_person) unfilledItems.push(['ผู้รับผิดชอบ', 'ยังไม่มีผู้รับผิดชอบ'])
  } else {
    if (!item.brand && !item.model) unfilledItems.push(['ยี่ห้อ / รุ่น', 'ไม่ระบุ'])
    if (!item.material?.specification) unfilledItems.push(['ขนาดหรือลักษณะ', 'ไม่ระบุ'])
    if (!item.material?.commodity_code) unfilledItems.push(['รหัสวัสดุ', 'ไม่ระบุ'])
  }

  const content = (
    <>
      {/* Header: Title, Category Subtitle & Close Button */}
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 min-w-0">
        <div className="flex flex-col min-w-0 pr-2 flex-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="sr-only">ประเภทสิ่งของ</span>
            <span className="sr-only">{item.item_type === 'asset' ? 'ครุภัณฑ์ (Asset)' : 'วัสดุ (Material)'}</span>
            <span>{item.item_type === 'material' ? 'รายละเอียดวัสดุ' : 'รายละเอียดสิ่งของ'}</span>
          </div>
          <TruncatedTextTooltip
            text={item.item_name}
            as="h3"
            className="truncate text-sm sm:text-base font-extrabold text-card-foreground leading-snug"
          />
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

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {/* Image Preview */}
        <div className="relative h-44 sm:h-48 shrink-0 overflow-hidden border-b border-border bg-muted/30 flex items-center justify-center p-2">
          {item.image_url ? (
            <ZoomableImage
              src={item.image_url}
              alt={item.item_name}
              className="h-full w-full"
              imgClassName="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
              <Package className="h-10 w-10 stroke-[1.25] text-muted-foreground/40" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                No Image Available
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 p-3.5 sm:p-4">
          {/* SECTION 1: ข้อมูลทั่วไป (ยี่ห้อ/รุ่น, Serial Number, หมวดหมู่, หน่วยนับ) */}
          {hasGeneralInfo && (
            <div className="flex flex-col gap-1.5">
              <SectionHeader icon={Info} title="ข้อมูลทั่วไป" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 min-w-0">
                {(item.brand || item.model) ? (
                  <InspectorBox tone="violet" label="ยี่ห้อ / รุ่น">
                    <TruncatedTextTooltip
                      text={[item.brand, item.model].filter(Boolean).join(' - ')}
                      as="div"
                      className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-medium text-card-foreground truncate"
                    />
                  </InspectorBox>
                ) : null}

                {item.item_type === 'asset' && item.serial_no ? (
                  <InspectorBox tone="blue" label="Serial Number">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <TruncatedTextTooltip
                        text={item.serial_no}
                        as="p"
                        className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs font-bold text-card-foreground min-w-0 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy('serial_no', item.serial_no)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary cursor-pointer shrink-0"
                        title="คัดลอก Serial Number"
                        aria-label="คัดลอก Serial Number"
                      >
                        {copiedField === 'serial_no' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </InspectorBox>
                ) : null}

                {item.category?.name ? (
                  <InspectorBox tone="emerald" label="หมวดหมู่">
                    <TruncatedTextTooltip
                      text={item.category.name}
                      as="div"
                      className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-medium text-card-foreground truncate"
                    />
                  </InspectorBox>
                ) : null}

                {item.unit?.name ? (
                  <InspectorBox tone="emerald" label="หน่วยนับ">
                    <div className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-medium text-card-foreground truncate">
                      {item.unit.name}
                    </div>
                  </InspectorBox>
                ) : null}
              </div>
            </div>
          )}

          {/* SECTION 2: ข้อมูลทะเบียน / สต็อก */}
          {item.item_type === 'asset' ? (
            <div className="flex flex-col gap-1.5">
              <SectionHeader icon={Tag} title="ข้อมูลทะเบียนครุภัณฑ์" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 min-w-0">
                {item.asset_no ? (
                  <InspectorBox tone="blue" label="เลขครุภัณฑ์">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <TruncatedTextTooltip
                        text={item.asset_no}
                        as="p"
                        className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs font-bold text-card-foreground min-w-0 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopy('asset_no', item.asset_no)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary cursor-pointer shrink-0"
                        title="คัดลอกเลขครุภัณฑ์"
                        aria-label="คัดลอกเลขครุภัณฑ์"
                      >
                        {copiedField === 'asset_no' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </InspectorBox>
                ) : null}

                {!item.asset_no && !item.serial_no ? (
                  <InspectorBox tone="blue" label="เลขอ้างอิง">
                    <p className="truncate rounded border border-border bg-muted/50 px-2.5 py-1 font-mono text-xs text-muted-foreground min-w-0">
                      - ไม่มีเลขอ้างอิง -
                    </p>
                  </InspectorBox>
                ) : null}

                <InspectorBox tone="emerald" label="สถานะทะเบียน">
                  <div className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-bold text-card-foreground truncate">
                    {item.qualification_status === 'qualified'
                      ? 'ตามเกณฑ์'
                      : item.qualification_status === 'below_threshold'
                      ? 'ต่ำกว่าเกณฑ์ (ต.)'
                      : 'ยังไม่ระบุ'}
                  </div>
                </InspectorBox>

                {item.acquired_date ? (
                  <InspectorBox tone="teal" label="วันที่ได้มา">
                    <div className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-medium text-card-foreground truncate">
                      {formatDateThaiBE(item.acquired_date)}
                    </div>
                  </InspectorBox>
                ) : null}
              </div>

              {/* Asset Register Details */}
              {hasAssetRegisterData && <AssetRegisterDetails item={item} />}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <SectionHeader icon={Layers} title="ข้อมูลสต็อก" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 min-w-0">
                <InspectorBox tone="violet" label="จำนวนคงเหลือ">
                  <div className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-bold text-card-foreground truncate">
                    {item.quantity} {item.unit?.name ?? ''}
                  </div>
                </InspectorBox>

                {item.material?.commodity_code ? (
                  <InspectorBox tone="blue" label="รหัสวัสดุ">
                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                      <p className="break-all font-mono text-xs font-medium text-card-foreground">{item.material.commodity_code}</p>
                      <button
                        type="button"
                        onClick={() => handleCopy('commodity_code', item.material?.commodity_code)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary cursor-pointer shrink-0"
                        title="คัดลอกรหัสวัสดุ"
                        aria-label="คัดลอกรหัสวัสดุ"
                      >
                        {copiedField === 'commodity_code' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </InspectorBox>
                ) : null}

                {item.material?.specification ? (
                  <InspectorBox tone="violet" label="ขนาดหรือลักษณะ" className="sm:col-span-2">
                    <p className="whitespace-pre-wrap break-words text-xs text-card-foreground">{item.material.specification}</p>
                  </InspectorBox>
                ) : null}

                {item.acquired_date ? (
                  <InspectorBox tone="teal" label="วันที่ได้มา">
                    <div className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-medium text-card-foreground truncate">
                      {formatDateThaiBE(item.acquired_date)}
                    </div>
                  </InspectorBox>
                ) : null}
              </div>

              {/* Detailed Stock Ledger (Collapsible) */}
              {item.material && (
                <div className="mt-1 rounded-xl border border-border bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setIsLedgerOpen(!isLedgerOpen)}
                    className="flex w-full items-center justify-between p-2.5 sm:p-3 text-left font-semibold text-xs text-foreground/80 hover:bg-muted/30 transition-colors cursor-pointer select-none"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <FileText className="h-3.5 w-3.5 text-teal-600" />
                      รายละเอียดบัญชีคุมยอดวัสดุ
                    </span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isLedgerOpen && "rotate-180")} />
                  </button>

                  {isLedgerOpen && (
                    <div className="border-t border-border/60 p-2.5 sm:p-3 bg-muted/10 flex flex-col gap-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {([
                          ['จำนวนอย่างต่ำ', item.material.minimum_quantity],
                          ['จำนวนอย่างสูง', item.material.maximum_quantity],
                          ['ยอดยกมา — จำนวน', item.material.opening_quantity],
                          ['ยอดยกมา — บาท', item.material.opening_amount],
                          ['รับ — จำนวน', item.material.received_quantity],
                          ['รับ — บาท', item.material.received_amount],
                          ['จ่าย — จำนวน', item.material.issued_quantity],
                          ['จ่าย — บาท', item.material.issued_amount],
                          ['จำนวนเงินตามบัญชี (บาท)', item.material.balance_amount],
                          ['ปีงบประมาณ พ.ศ.', item.material.fiscal_year],
                        ] as const).map(([label, value]) => (
                          <InspectorBox key={label} tone="teal" label={label}>
                            <p className="text-xs tabular-nums text-card-foreground">
                              {value == null ? '—' : Number(value).toLocaleString('th-TH', { maximumFractionDigits: 2 })}
                            </p>
                          </InspectorBox>
                        ))}
                      </div>
                      <InspectorBox tone="teal" label="วันที่ยอดตามบัญชี">
                        <p className="text-xs text-card-foreground">{item.material.balance_as_of ? formatDateThaiBE(item.material.balance_as_of) : '—'}</p>
                      </InspectorBox>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: ข้อมูลการเงิน (ราคาต่อหน่วย, มูลค่าตามทะเบียน, GFMIS, รับจาก) */}
          {hasFinancialInfo && (
            <div className="flex flex-col gap-1.5">
              <SectionHeader icon={DollarSign} title="ข้อมูลการเงิน" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 min-w-0">
                <InspectorBox tone="teal" label="ราคาต่อหน่วย">
                  <div className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-bold text-card-foreground truncate">
                    {item.unit_price !== null && item.unit_price !== undefined ? `฿${item.unit_price.toLocaleString()}` : '-'}
                  </div>
                </InspectorBox>

                {item.register_book_value != null && item.register_book_value !== item.unit_price ? (
                  <InspectorBox tone="teal" label="มูลค่าตามทะเบียน">
                    <div className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-bold text-card-foreground truncate">
                      {Number(item.register_book_value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                    </div>
                  </InspectorBox>
                ) : null}

                {item.gfmis_number ? (
                  <InspectorBox tone="teal" label="เลขสินทรัพย์ (GFMIS)">
                    <TruncatedTextTooltip
                      text={item.gfmis_number}
                      as="div"
                      className="rounded-lg border border-border bg-muted/40 p-2 font-mono text-xs font-semibold text-card-foreground truncate"
                    />
                  </InspectorBox>
                ) : null}

                {item.budget_source ? (
                  <InspectorBox tone="teal" label="รับจาก (งปม.)">
                    <TruncatedTextTooltip
                      text={item.budget_source}
                      as="div"
                      className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-medium text-card-foreground truncate"
                    />
                  </InspectorBox>
                ) : null}
              </div>
            </div>
          )}

          {/* SECTION 4: สถานที่และผู้รับผิดชอบ */}
          <div className="flex flex-col gap-1.5">
            <SectionHeader icon={MapPin} title="สถานที่และผู้รับผิดชอบ" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5 min-w-0">
              <InspectorBox tone="indigo" label="สถานที่จัดเก็บ">
                <TruncatedTextTooltip
                  text={item.location?.name || 'ไม่ได้ระบุ'}
                  as="div"
                  className="rounded-lg border border-border bg-muted/40 p-2 text-xs font-medium text-card-foreground truncate"
                />
              </InspectorBox>

              {(item.item_type === 'asset' || item.responsible_person) && (
                <InspectorBox tone="indigo" label="ผู้รับผิดชอบ">
                  <div className="flex items-center rounded-lg border border-border bg-muted/40 p-2 text-xs font-medium text-card-foreground min-w-0">
                    <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10 text-xs font-bold text-indigo-600">
                      {(item.responsible_person || 'U').charAt(0).toUpperCase()}
                    </div>
                    <TruncatedTextTooltip
                      text={item.responsible_person || 'ยังไม่มีผู้รับผิดชอบ'}
                      as="span"
                      className="font-bold text-card-foreground truncate flex-1 min-w-0"
                    />
                  </div>
                </InspectorBox>
              )}
            </div>
          </div>

          {/* SECTION 5: ข้อมูลเพิ่มเติม (Collapsible) */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => setIsAdditionalOpen(!isAdditionalOpen)}
              className="flex w-full items-center justify-between p-2.5 sm:p-3 text-left font-semibold text-xs text-foreground/80 hover:bg-muted/30 transition-colors cursor-pointer select-none"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold">
                <Info className="h-3.5 w-3.5 text-slate-500" />
                ข้อมูลเพิ่มเติม
                {unfilledItems.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground font-normal">
                    ({unfilledItems.length} รายการที่ว่าง)
                  </span>
                )}
              </span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isAdditionalOpen && "rotate-180")} />
            </button>

            {isAdditionalOpen && (
              <div className="border-t border-border/60 p-2.5 sm:p-3 bg-muted/10 flex flex-col gap-2.5">
                {/* Note */}
                <InspectorBox tone="slate" label={item.item_type === 'material' ? 'หมายเหตุ' : 'รายละเอียดเพิ่มเติม'}>
                  <p className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-2 text-xs leading-relaxed text-muted-foreground break-words min-w-0">
                    {item.note || '- ไม่มีหมายเหตุ -'}
                  </p>
                </InspectorBox>

                {/* Items with no data */}
                {unfilledItems.length > 0 && (
                  <div className="rounded-lg border border-border/70 bg-card p-2.5 text-xs space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      รายการที่ไม่ได้ระบุข้อมูล
                    </p>
                    {unfilledItems.map(([label, val]) => (
                      <div key={label} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="text-muted-foreground/80">{val}</span>
                      </div>
                    ))}
                  </div>
                )}

                {item.updated_at && (
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                    <span>อัปเดตล่าสุด</span>
                    <span>{formatDateThaiBE(item.updated_at)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
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

      {/* Drawer Panel (Mobile full width, desktop 420-480px) */}
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

function SectionHeader({
  icon: Icon,
  title,
  count,
}: {
  icon?: React.ElementType
  title: string
  count?: number | string
}) {
  return (
    <div className="flex items-center gap-1.5 pt-1 pb-0.5">
      {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
      <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h5>
      {count !== undefined && (
        <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  )
}

function InspectorBox({
  label,
  children,
  tone = 'default',
  className,
}: {
  label: string
  children: ReactNode
  tone?: 'blue' | 'violet' | 'teal' | 'indigo' | 'slate' | 'emerald' | 'default'
  className?: string
}) {
  const toneLabelClasses = {
    blue: 'text-blue-600',
    emerald: 'text-emerald-600',
    violet: 'text-violet-600',
    teal: 'text-teal-600',
    indigo: 'text-indigo-600',
    slate: 'text-slate-600',
    default: 'text-primary',
  }

  return (
    <div className={cn('rounded-xl border border-border/80 bg-card p-2.5 sm:p-3 shadow-2xs min-w-0', className)}>
      <p className={`mb-1 flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider ${toneLabelClasses[tone]} min-w-0`}>
        <span className="truncate">{label}</span>
      </p>
      {children}
    </div>
  )
}
