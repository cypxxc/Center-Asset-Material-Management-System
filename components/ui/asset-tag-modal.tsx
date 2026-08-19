'use client'

import * as React from "react"
import { Printer, X, Tag, ChevronLeft, ChevronRight, SlidersHorizontal, LayoutGrid, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { generateCode128Bars } from "@/lib/barcode"
import { generateQrCodeSvgPath } from "@/lib/qr-code"

export interface ItemStickerData {
  id?: string | null
  item_name: string
  asset_no?: string | null
  serial_no?: string | null
  brand?: string | null
  model?: string | null
  location_name?: string | null
  category_name?: string | null
  responsible_person?: string | null
  unit_price?: number | null
}

export interface AssetTagModalProps {
  isOpen: boolean
  onClose: () => void
  item?: ItemStickerData
  items?: ItemStickerData[]
}

export type StickerSizePreset = "a4_3x8" | "a4_2x7" | "standard" | "small" | "compact" | "custom_grid"

export interface CustomGridConfig {
  cols: number
  rows: number
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  gap: number
}

export interface PresetConfig {
  id: StickerSizePreset
  label: string
  isSheet: boolean
  sheetGrid?: {
    cols: number
    rows: number
    labelWidth: string
    labelHeight: string
    gap?: string
    marginTop?: number
    marginBottom?: number
    marginLeft?: number
    marginRight?: number
  }
  width: string
  height: string
  padding: string
  titleSize: string
  nameSize: string
  metaSize: string
  barcodeHeight: string
  codeSize: string
  qrSize: string
}

export interface FieldVisibilityConfig {
  showOrg: boolean
  showResponsible: boolean
  showLocation: boolean
  showPrice: boolean
  showBarcode: boolean
  showQr: boolean
}

export function calculateCustomGridDimensions(config: CustomGridConfig): { width: number; height: number } {
  const width = Math.max(10, (210 - (config.marginLeft + config.marginRight) - (config.cols - 1) * config.gap) / config.cols)
  const height = Math.max(10, (297 - (config.marginTop + config.marginBottom) - (config.rows - 1) * config.gap) / config.rows)
  return {
    width: Number(width.toFixed(1)),
    height: Number(height.toFixed(1)),
  }
}

export function getTypographyForHeight(heightMm: number): {
  padding: string
  titleSize: string
  nameSize: string
  metaSize: string
  barcodeHeight: string
  codeSize: string
  qrSize: string
} {
  if (heightMm >= 45) {
    return {
      padding: "p-3",
      titleSize: "text-[10px]",
      nameSize: "text-xs font-bold",
      metaSize: "text-[9.5px]",
      barcodeHeight: "h-7",
      codeSize: "text-[10px]",
      qrSize: "h-14 w-14",
    }
  } else if (heightMm >= 35) {
    return {
      padding: "p-2",
      titleSize: "text-[8.5px]",
      nameSize: "text-[10.5px] font-bold",
      metaSize: "text-[8.5px]",
      barcodeHeight: "h-5",
      codeSize: "text-[9px]",
      qrSize: "h-11 w-11",
    }
  } else if (heightMm >= 25) {
    return {
      padding: "p-1.5",
      titleSize: "text-[7.5px]",
      nameSize: "text-[9.5px] font-bold",
      metaSize: "text-[7.5px]",
      barcodeHeight: "h-4.5",
      codeSize: "text-[8px]",
      qrSize: "h-9 w-9",
    }
  } else {
    return {
      padding: "p-1",
      titleSize: "text-[6.5px]",
      nameSize: "text-[8.5px] font-bold",
      metaSize: "text-[6.5px]",
      barcodeHeight: "h-3.5",
      codeSize: "text-[7px]",
      qrSize: "h-7 w-7",
    }
  }
}

export const PRESETS: Record<StickerSizePreset, PresetConfig> = {
  a4_3x8: {
    id: "a4_3x8",
    label: "A4 3×8 (24 ป้าย/แผ่น)",
    isSheet: true,
    sheetGrid: {
      cols: 3,
      rows: 8,
      labelWidth: "68mm",
      labelHeight: "35mm",
      gap: "2.5mm",
      marginTop: 5,
      marginBottom: 5,
      marginLeft: 5,
      marginRight: 5,
    },
    width: "68mm",
    height: "35mm",
    padding: "p-2",
    titleSize: "text-[8.5px]",
    nameSize: "text-[10.5px] font-bold",
    metaSize: "text-[8.5px]",
    barcodeHeight: "h-5",
    codeSize: "text-[9px]",
    qrSize: "h-11 w-11",
  },
  a4_2x7: {
    id: "a4_2x7",
    label: "A4 2×7 (14 ป้าย/แผ่น)",
    isSheet: true,
    sheetGrid: {
      cols: 2,
      rows: 7,
      labelWidth: "100mm",
      labelHeight: "40mm",
      gap: "2.5mm",
      marginTop: 5,
      marginBottom: 5,
      marginLeft: 5,
      marginRight: 5,
    },
    width: "100mm",
    height: "40mm",
    padding: "p-2.5",
    titleSize: "text-[9.5px]",
    nameSize: "text-[11.5px] font-bold",
    metaSize: "text-[9px]",
    barcodeHeight: "h-6",
    codeSize: "text-[10px]",
    qrSize: "h-13 w-13",
  },
  custom_grid: {
    id: "custom_grid",
    label: "A4 กำหนดเอง (Custom Grid)",
    isSheet: true,
    sheetGrid: {
      cols: 3,
      rows: 8,
      labelWidth: "65.0mm",
      labelHeight: "33.7mm",
      gap: "2.5mm",
      marginTop: 5,
      marginBottom: 5,
      marginLeft: 5,
      marginRight: 5,
    },
    width: "65.0mm",
    height: "33.7mm",
    padding: "p-2",
    titleSize: "text-[8.5px]",
    nameSize: "text-[10.5px] font-bold",
    metaSize: "text-[8.5px]",
    barcodeHeight: "h-5",
    codeSize: "text-[9px]",
    qrSize: "h-11 w-11",
  },
  standard: {
    id: "standard",
    label: "Standard (70×35mm)",
    isSheet: false,
    width: "70mm",
    height: "35mm",
    padding: "p-2.5",
    titleSize: "text-[9px]",
    nameSize: "text-[11px] font-bold",
    metaSize: "text-[9px]",
    barcodeHeight: "h-6",
    codeSize: "text-[10px]",
    qrSize: "h-14 w-14",
  },
  small: {
    id: "small",
    label: "Small (50×25mm)",
    isSheet: false,
    width: "50mm",
    height: "25mm",
    padding: "p-1.5",
    titleSize: "text-[7.5px]",
    nameSize: "text-[9.5px] font-bold",
    metaSize: "text-[7.5px]",
    barcodeHeight: "h-4.5",
    codeSize: "text-[8px]",
    qrSize: "h-9 w-9",
  },
  compact: {
    id: "compact",
    label: "Compact (40×20mm)",
    isSheet: false,
    width: "40mm",
    height: "20mm",
    padding: "p-1",
    titleSize: "text-[6.5px]",
    nameSize: "text-[8.5px] font-bold",
    metaSize: "text-[6.5px]",
    barcodeHeight: "h-3.5",
    codeSize: "text-[7px]",
    qrSize: "h-7 w-7",
  },
}

function SingleStickerItem({
  itemData,
  presetConfig,
  visibility,
}: {
  itemData: ItemStickerData
  presetConfig: PresetConfig
  visibility: FieldVisibilityConfig
}) {
  const barcodeText = itemData.asset_no || itemData.serial_no || ""
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  const itemUrl = itemData.id
    ? `${baseUrl}/items/${itemData.id}`
    : (itemData.asset_no || itemData.serial_no || "")

  let barcodeData = null
  if (visibility.showBarcode && barcodeText) {
    try {
      barcodeData = generateCode128Bars(barcodeText)
    } catch {
      barcodeData = null
    }
  }

  let qrCodeData = null
  if (visibility.showQr && itemUrl) {
    try {
      qrCodeData = generateQrCodeSvgPath(itemUrl)
    } catch {
      qrCodeData = null
    }
  }

  const brandModel = [itemData.brand, itemData.model].filter(Boolean).join(" ")

  return (
    <div
      style={{
        width: presetConfig.width,
        height: presetConfig.height,
      }}
      className={`print-tag-card bg-white text-slate-900 border border-slate-900 shadow-xs flex flex-col justify-between overflow-hidden box-border page-break-inside-avoid break-inside-avoid ${presetConfig.padding}`}
    >
      {/* Sticker Header */}
      {visibility.showOrg && (
        <div className="border-b border-slate-900 pb-0.5 mb-1 text-center shrink-0">
          <div className={`font-bold tracking-tight text-slate-900 ${presetConfig.titleSize}`}>
            CAMMS — ระบบบริหารจัดการทรัพย์สิน
          </div>
        </div>
      )}

      {/* Sticker Content Area: Dual Column (Left Details + Barcode, Right QR Code) */}
      <div className="flex-1 flex items-stretch justify-between gap-1.5 min-h-0">
        {/* Left Column: Details & Code 128 Barcode */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div className="space-y-0.5">
            <div className={`truncate leading-tight ${presetConfig.nameSize}`} title={itemData.item_name}>
              {itemData.item_name}
            </div>
            {brandModel && (
              <div className={`truncate text-slate-700 leading-tight ${presetConfig.metaSize}`}>
                {brandModel}
              </div>
            )}
            {visibility.showLocation && itemData.location_name && (
              <div className={`truncate text-slate-600 leading-tight ${presetConfig.metaSize}`}>
                สถานที่: {itemData.location_name}
              </div>
            )}
            {visibility.showResponsible && itemData.responsible_person && (
              <div className={`truncate text-slate-600 leading-tight ${presetConfig.metaSize}`}>
                ผู้รับผิดชอบ: {itemData.responsible_person}
              </div>
            )}
            {visibility.showPrice && itemData.unit_price != null && (
              <div className={`truncate text-slate-600 leading-tight ${presetConfig.metaSize}`}>
                ราคา: {Number(itemData.unit_price).toLocaleString('th-TH')} บาท
              </div>
            )}
          </div>

          {/* Barcode SVG section */}
          {visibility.showBarcode && (
            <div className="mt-0.5 flex flex-col items-start justify-center w-full">
              {barcodeData && barcodeData.bars.length > 0 ? (
                <>
                  <svg
                    viewBox={`0 0 ${barcodeData.totalWidth} 40`}
                    className={`w-full ${presetConfig.barcodeHeight}`}
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`บาร์โค้ด ${barcodeText}`}
                  >
                    {barcodeData.bars.map((bar, i) => (
                      <rect
                        key={i}
                        x={bar.x}
                        y={0}
                        width={bar.width}
                        height={40}
                        fill="black"
                      />
                    ))}
                  </svg>
                  <div
                    className={`font-mono font-bold text-slate-900 leading-none ${presetConfig.codeSize} tracking-wider`}
                  >
                    {barcodeText}
                  </div>
                </>
              ) : (
                <div className={`text-slate-400 italic ${presetConfig.metaSize}`}>
                  ไม่มีรหัสบาร์โค้ด
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Direct Link QR Code for Mobile Phones */}
        {visibility.showQr && qrCodeData && (
          <div className="flex flex-col items-center justify-center shrink-0 border-l border-slate-200 pl-1">
            <svg
              viewBox={`0 0 ${qrCodeData.size} ${qrCodeData.size}`}
              className={presetConfig.qrSize}
              role="img"
              aria-label={`QR Code ลิงก์ ${itemUrl}`}
            >
              <path d={qrCodeData.path} fill="black" />
            </svg>
            <span className="text-[6px] font-bold text-slate-500 tracking-tighter leading-none mt-0.5 uppercase">
              มือถือสแกน
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function A4SheetPreview({
  items,
  cols,
  rows,
  pageIndex,
  marginTop = 5,
  marginBottom = 5,
  marginLeft = 5,
  marginRight = 5,
  gap = 2.5,
}: {
  items: ItemStickerData[]
  cols: number
  rows: number
  pageIndex: number
  marginTop?: number
  marginBottom?: number
  marginLeft?: number
  marginRight?: number
  gap?: number
}) {
  const labelsPerPage = cols * rows
  const pageItems = items.slice(pageIndex * labelsPerPage, (pageIndex + 1) * labelsPerPage)

  const baseWidth = 240
  const scale = baseWidth / 210
  const baseHeight = Math.round(297 * scale)

  return (
    <div
      data-testid="a4-sheet-preview"
      className="bg-white shadow-md border border-slate-300 rounded-sm overflow-hidden box-border mx-auto select-none transition-all flex flex-col justify-between"
      style={{
        width: `${baseWidth}px`,
        height: `${baseHeight}px`,
        paddingTop: `${Math.max(1, marginTop * scale)}px`,
        paddingBottom: `${Math.max(1, marginBottom * scale)}px`,
        paddingLeft: `${Math.max(1, marginLeft * scale)}px`,
        paddingRight: `${Math.max(1, marginRight * scale)}px`,
      }}
    >
      <div
        className="w-full h-full grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          gap: `${Math.max(1, gap * scale)}px`,
        }}
      >
        {Array.from({ length: labelsPerPage }).map((_, slotIdx) => {
          const item = pageItems[slotIdx]
          if (item) {
            return (
              <div
                key={slotIdx}
                className="border border-slate-800 bg-white rounded-[1px] p-0.5 flex flex-col justify-between overflow-hidden text-[5.5px] leading-tight box-border shadow-2xs min-w-0 min-h-0"
                title={`${item.item_name} (${item.asset_no || item.serial_no || ""})`}
              >
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-start">
                  <div className="font-bold text-slate-900 truncate leading-tight">
                    {item.item_name}
                  </div>
                  {(item.asset_no || item.serial_no) && (
                    <div className="font-mono text-[5px] text-slate-600 truncate leading-none">
                      {item.asset_no || item.serial_no}
                    </div>
                  )}
                </div>
                <div className="h-1 w-full bg-slate-800/80 rounded-[0.5px] shrink-0 mt-0.5" />
              </div>
            )
          }
          return (
            <div
              key={slotIdx}
              className="border border-dashed border-slate-300 bg-slate-50/50 rounded-[1px] flex items-center justify-center text-[5px] text-slate-300 font-mono select-none min-w-0 min-h-0"
            >
              ว่าง
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AssetTagModal({
  isOpen,
  onClose,
  item,
  items,
}: AssetTagModalProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<StickerSizePreset>("standard")
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [copyCount, setCopyCount] = React.useState<number>(1)
  const [showAdvancedToggles, setShowAdvancedToggles] = React.useState(false)
  const [previewMode, setPreviewMode] = React.useState<"single" | "sheet">("single")
  const [sheetPageIndex, setSheetPageIndex] = React.useState(0)

  const [customGrid, setCustomGrid] = React.useState<CustomGridConfig>({
    cols: 3,
    rows: 8,
    marginTop: 5,
    marginBottom: 5,
    marginLeft: 5,
    marginRight: 5,
    gap: 2.5,
  })

  const [fieldVisibility, setFieldVisibility] = React.useState<FieldVisibilityConfig>({
    showOrg: true,
    showResponsible: false,
    showLocation: true,
    showPrice: false,
    showBarcode: true,
    showQr: true,
  })

  const rawItemList: ItemStickerData[] = React.useMemo(() => {
    if (items && items.length > 0) return items
    if (item) return [item]
    return []
  }, [item, items])

  // Multiply items by copyCount
  const expandedPrintList: ItemStickerData[] = React.useMemo(() => {
    const validMultiplier = Math.max(1, Math.min(50, copyCount || 1))
    const list: ItemStickerData[] = []
    for (const itm of rawItemList) {
      for (let i = 0; i < validMultiplier; i++) {
        list.push(itm)
      }
    }
    return list
  }, [rawItemList, copyCount])

  const [prevIsOpen, setPrevIsOpen] = React.useState(isOpen)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setCurrentIndex(0)
      setSheetPageIndex(0)
    }
  }

  // Escape key listener
  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  const customDimensions = React.useMemo(() => {
    return calculateCustomGridDimensions(customGrid)
  }, [customGrid])

  const activeConfig: PresetConfig = React.useMemo(() => {
    if (selectedPreset === "custom_grid") {
      const { width, height } = customDimensions
      const typography = getTypographyForHeight(height)
      return {
        id: "custom_grid",
        label: "A4 กำหนดเอง (Custom Grid)",
        isSheet: true,
        sheetGrid: {
          cols: customGrid.cols,
          rows: customGrid.rows,
          labelWidth: `${width}mm`,
          labelHeight: `${height}mm`,
          gap: `${customGrid.gap}mm`,
          marginTop: customGrid.marginTop,
          marginBottom: customGrid.marginBottom,
          marginLeft: customGrid.marginLeft,
          marginRight: customGrid.marginRight,
        },
        width: `${width}mm`,
        height: `${height}mm`,
        ...typography,
      }
    }
    return PRESETS[selectedPreset]
  }, [selectedPreset, customGrid, customDimensions])

  if (!isOpen || rawItemList.length === 0) return null

  const isMultiItem = rawItemList.length > 1
  const currentItem = rawItemList[currentIndex] || rawItemList[0]
  const sheetCols = activeConfig.sheetGrid?.cols || 1
  const sheetRows = activeConfig.sheetGrid?.rows || 1
  const labelsPerPage = sheetCols * sheetRows
  const totalPages = Math.max(1, Math.ceil(expandedPrintList.length / labelsPerPage))
  const safeSheetPageIndex = Math.min(sheetPageIndex, totalPages - 1)

  const printMargin = selectedPreset === "custom_grid"
    ? `${customGrid.marginTop}mm ${customGrid.marginRight}mm ${customGrid.marginBottom}mm ${customGrid.marginLeft}mm`
    : "5mm"

  const printGap = selectedPreset === "custom_grid"
    ? `${customGrid.gap}mm`
    : (activeConfig.sheetGrid?.gap || "2.5mm")

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print()
    }
  }

  const toggleField = (key: keyof FieldVisibilityConfig) => {
    setFieldVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-asset-tag, #printable-asset-tag * {
            visibility: visible !important;
          }
          #printable-asset-tag {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-tag-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            box-sizing: border-box !important;
          }
          ${
            activeConfig.isSheet
              ? `
          @page {
            size: A4 portrait;
            margin: ${printMargin};
          }
          .print-sheet-grid {
            display: grid !important;
            grid-template-columns: repeat(${sheetCols}, 1fr) !important;
            gap: ${printGap} !important;
            justify-items: center !important;
            align-items: start !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          `
              : `
          @page {
            size: auto;
            margin: 0;
          }
          .print-thermal-roll {
            display: flex !important;
            flex-direction: column !important;
            gap: 2mm !important;
            padding: 2mm !important;
            align-items: flex-start !important;
          }
          `
          }
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-tag-modal-title"
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <div className="p-1.5 bg-slate-900 text-white rounded-lg">
              <Tag className="h-4 w-4" />
            </div>
            <span id="asset-tag-modal-title">
              พิมพ์ลาเบลติดครุภัณฑ์ {isMultiItem && `(${rawItemList.length} รายการ)`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 bg-slate-50/50 overflow-y-auto">
          {/* Preset Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                รูปแบบและขนาดลาเบล (Label Preset)
              </label>
              <span className="text-[11px] text-slate-500 font-medium">
                {activeConfig.isSheet ? "กระดาษ A4 สติกเกอร์" : "ม้วนสติกเกอร์ความร้อน (Thermal)"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(PRESETS) as StickerSizePreset[]).map((key) => {
                const p = PRESETS[key]
                const isSelected = selectedPreset === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedPreset(key)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-medium transition-all text-left flex flex-col justify-center cursor-pointer ${
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white shadow-xs font-semibold"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="truncate">{p.label}</span>
                    <span className={`text-[10px] ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                      {key === "custom_grid"
                        ? `${customDimensions.width} × ${customDimensions.height} mm`
                        : p.isSheet
                        ? "A4 Sheet Grid"
                        : `${p.width} × ${p.height}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom Grid Interactive Configuration Controls */}
          {selectedPreset === "custom_grid" && (
            <div className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-3 animate-in fade-in-50 duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-slate-700" />
                  ตั้งค่าตาราง Grid (คอลัมน์ × แถว บน A4)
                </span>
                <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200/70 inline-block self-start sm:self-auto">
                  ขนาดป้ายต่อดวง: {customDimensions.width.toFixed(1)} × {customDimensions.height.toFixed(1)} mm | รวม {customGrid.cols * customGrid.rows} ป้าย/แผ่น
                </span>
              </div>

              {/* Columns & Rows Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Columns */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="custom-grid-cols-range" className="font-semibold text-slate-700">
                      จำนวนคอลัมน์ (Columns)
                    </label>
                    <span className="font-bold text-slate-900">{customGrid.cols} คอลัมน์</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="custom-grid-cols-range"
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={customGrid.cols}
                      onChange={(e) =>
                        setCustomGrid((prev) => ({
                          ...prev,
                          cols: parseInt(e.target.value, 10) || 1,
                        }))
                      }
                      className="flex-1 accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      aria-label="แถบเลื่อนจำนวนคอลัมน์ (1-5)"
                    />
                    <input
                      id="custom-grid-cols-number"
                      type="number"
                      min="1"
                      max="5"
                      value={customGrid.cols}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10)
                        setCustomGrid((prev) => ({
                          ...prev,
                          cols: isNaN(val) ? 1 : Math.max(1, Math.min(5, val)),
                        }))
                      }}
                      className="w-12 h-7 text-center text-xs font-bold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                      aria-label="ช่องกรอกจำนวนคอลัมน์"
                    />
                  </div>
                </div>

                {/* Rows */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="custom-grid-rows-range" className="font-semibold text-slate-700">
                      จำนวนแถว (Rows)
                    </label>
                    <span className="font-bold text-slate-900">{customGrid.rows} แถว</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="custom-grid-rows-range"
                      type="range"
                      min="1"
                      max="12"
                      step="1"
                      value={customGrid.rows}
                      onChange={(e) =>
                        setCustomGrid((prev) => ({
                          ...prev,
                          rows: parseInt(e.target.value, 10) || 1,
                        }))
                      }
                      className="flex-1 accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      aria-label="แถบเลื่อนจำนวนแถว (1-12)"
                    />
                    <input
                      id="custom-grid-rows-number"
                      type="number"
                      min="1"
                      max="12"
                      value={customGrid.rows}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10)
                        setCustomGrid((prev) => ({
                          ...prev,
                          rows: isNaN(val) ? 1 : Math.max(1, Math.min(12, val)),
                        }))
                      }}
                      className="w-12 h-7 text-center text-xs font-bold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                      aria-label="ช่องกรอกจำนวนแถว"
                    />
                  </div>
                </div>
              </div>

              {/* Gap & Margins Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                {/* Gap */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="custom-grid-gap-range" className="font-semibold text-slate-700">
                      ระยะห่างระหว่างป้าย (Gap)
                    </label>
                    <span className="font-bold text-slate-900">{customGrid.gap} mm</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="custom-grid-gap-range"
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={customGrid.gap}
                      onChange={(e) =>
                        setCustomGrid((prev) => ({
                          ...prev,
                          gap: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="flex-1 accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      aria-label="แถบเลื่อนระยะห่างระหว่างป้าย (0-10 mm)"
                    />
                    <input
                      id="custom-grid-gap-number"
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      value={customGrid.gap}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        setCustomGrid((prev) => ({
                          ...prev,
                          gap: isNaN(val) ? 0 : Math.max(0, Math.min(10, val)),
                        }))
                      }}
                      className="w-12 h-7 text-center text-xs font-bold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                      aria-label="ช่องกรอกระยะห่างระหว่างป้าย"
                    />
                  </div>
                </div>

                {/* Margins */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      ระยะขอบกระดาษ (Margins: 0-20mm)
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500 font-medium">บน</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.5"
                        value={customGrid.marginTop}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          setCustomGrid((prev) => ({
                            ...prev,
                            marginTop: isNaN(val) ? 0 : Math.max(0, Math.min(20, val)),
                          }))
                        }}
                        className="w-full h-7 text-center text-xs font-bold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                        aria-label="ระยะขอบบน (mm)"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500 font-medium">ล่าง</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.5"
                        value={customGrid.marginBottom}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          setCustomGrid((prev) => ({
                            ...prev,
                            marginBottom: isNaN(val) ? 0 : Math.max(0, Math.min(20, val)),
                          }))
                        }}
                        className="w-full h-7 text-center text-xs font-bold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                        aria-label="ระยะขอบล่าง (mm)"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500 font-medium">ซ้าย</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.5"
                        value={customGrid.marginLeft}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          setCustomGrid((prev) => ({
                            ...prev,
                            marginLeft: isNaN(val) ? 0 : Math.max(0, Math.min(20, val)),
                          }))
                        }}
                        className="w-full h-7 text-center text-xs font-bold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                        aria-label="ระยะขอบซ้าย (mm)"
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-slate-500 font-medium">ขวา</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.5"
                        value={customGrid.marginRight}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value)
                          setCustomGrid((prev) => ({
                            ...prev,
                            marginRight: isNaN(val) ? 0 : Math.max(0, Math.min(20, val)),
                          }))
                        }}
                        className="w-full h-7 text-center text-xs font-bold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                        aria-label="ระยะขอบขวา (mm)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Copy Multiplier & Toggle Settings Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Copy Multiplier */}
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800">จำนวนดวงต่อรายการ</div>
                <div className="text-[11px] text-slate-500">สำเนาลาเบล (Copies)</div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCopyCount((prev) => Math.max(1, (prev || 1) - 1))}
                  className="w-7 h-7 rounded-lg border border-slate-300 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
                  disabled={copyCount <= 1}
                  aria-label="ลดจำนวนสำเนา"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={copyCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    setCopyCount(isNaN(val) ? 1 : Math.max(1, Math.min(50, val)))
                  }}
                  className="w-12 h-7 rounded-lg border border-slate-300 text-center font-bold text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                  aria-label="จำนวนสำเนาลาเบล"
                />
                <button
                  type="button"
                  onClick={() => setCopyCount((prev) => Math.min(50, (prev || 1) + 1))}
                  className="w-7 h-7 rounded-lg border border-slate-300 flex items-center justify-center font-bold text-slate-700 hover:bg-slate-100 cursor-pointer disabled:opacity-40"
                  disabled={copyCount >= 50}
                  aria-label="เพิ่มจำนวนสำเนา"
                >
                  +
                </button>
              </div>
            </div>

            {/* Field Visibility Config Toggle Button */}
            <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800">ข้อมูลบนลาเบล</div>
                <div className="text-[11px] text-slate-500">เลือกฟิลด์ที่ต้องการแสดง</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedToggles((prev) => !prev)}
                className={`h-7 px-2.5 text-xs font-semibold rounded-lg cursor-pointer ${
                  showAdvancedToggles ? "bg-slate-100 text-slate-900" : ""
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                {showAdvancedToggles ? "ซ่อนตัวเลือก" : "ปรับแต่งฟิลด์"}
              </Button>
            </div>
          </div>

          {/* Collapsible Field Toggles */}
          {showAdvancedToggles && (
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2.5 animate-in fade-in-50 duration-150 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                ตัวเลือกการแสดงผลข้อมูล (Field Visibility)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fieldVisibility.showOrg}
                    onChange={() => toggleField("showOrg")}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4"
                  />
                  <span>ชื่อระบบ / CAMMS</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fieldVisibility.showLocation}
                    onChange={() => toggleField("showLocation")}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4"
                  />
                  <span>สถานที่จัดเก็บ</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fieldVisibility.showResponsible}
                    onChange={() => toggleField("showResponsible")}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4"
                  />
                  <span>ผู้รับผิดชอบ</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fieldVisibility.showPrice}
                    onChange={() => toggleField("showPrice")}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4"
                  />
                  <span>ราคาทรัพย์สิน</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fieldVisibility.showBarcode}
                    onChange={() => toggleField("showBarcode")}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4"
                  />
                  <span>Barcode (Code128)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fieldVisibility.showQr}
                    onChange={() => toggleField("showQr")}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4"
                  />
                  <span>QR Code ลิงก์</span>
                </label>
              </div>
            </div>
          )}

          {/* Sticker Preview Container */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <label className="text-xs font-semibold text-slate-700">
                ตัวอย่างสติกเกอร์ (Live Preview)
              </label>

              <div className="flex items-center gap-2">
                {activeConfig.isSheet && (
                  <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg border border-slate-300/80 text-xs">
                    <button
                      type="button"
                      onClick={() => setPreviewMode("single")}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        previewMode === "single"
                          ? "bg-white text-slate-900 shadow-xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      aria-label="ดูตัวอย่างแบบดวงเดี่ยว (Single)"
                    >
                      <Square className="h-3 w-3" />
                      <span>ดวงเดี่ยว (Single)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode("sheet")}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        previewMode === "sheet"
                          ? "bg-white text-slate-900 shadow-xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                      aria-label="ดูตัวอย่างทั้งแผ่น A4 (A4 Sheet Preview)"
                    >
                      <LayoutGrid className="h-3 w-3" />
                      <span>ทั้งแผ่น A4 (Sheet)</span>
                    </button>
                  </div>
                )}

                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                  รวมพิมพ์ {expandedPrintList.length} ดวง
                </span>

                {previewMode === "single" && isMultiItem && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                      className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="รายการก่อนหน้า"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span>
                      {currentIndex + 1} / {rawItemList.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentIndex === rawItemList.length - 1}
                      onClick={() => setCurrentIndex((prev) => Math.min(rawItemList.length - 1, prev + 1))}
                      className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="รายการถัดไป"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {previewMode === "sheet" && activeConfig.isSheet && totalPages > 1 && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      disabled={safeSheetPageIndex === 0}
                      onClick={() => setSheetPageIndex((prev) => Math.max(0, prev - 1))}
                      className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="แผ่นก่อนหน้า"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span>
                      แผ่นที่ {safeSheetPageIndex + 1} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeSheetPageIndex >= totalPages - 1}
                      onClick={() => setSheetPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
                      className="p-0.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      aria-label="แผ่นถัดไป"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-slate-200/70 rounded-xl flex items-center justify-center min-h-[220px] border border-slate-300/60 shadow-inner overflow-x-auto">
              {previewMode === "sheet" && activeConfig.isSheet ? (
                <A4SheetPreview
                  items={expandedPrintList}
                  cols={sheetCols}
                  rows={sheetRows}
                  pageIndex={safeSheetPageIndex}
                  marginTop={selectedPreset === "custom_grid" ? customGrid.marginTop : 5}
                  marginBottom={selectedPreset === "custom_grid" ? customGrid.marginBottom : 5}
                  marginLeft={selectedPreset === "custom_grid" ? customGrid.marginLeft : 5}
                  marginRight={selectedPreset === "custom_grid" ? customGrid.marginRight : 5}
                  gap={selectedPreset === "custom_grid" ? customGrid.gap : 2.5}
                />
              ) : (
                <SingleStickerItem
                  itemData={currentItem}
                  presetConfig={activeConfig}
                  visibility={fieldVisibility}
                />
              )}
            </div>
          </div>
        </div>

        {/* Hidden printable container for window.print() */}
        <div
          id="printable-asset-tag"
          className={activeConfig.isSheet ? "print-sheet-grid hidden" : "print-thermal-roll hidden"}
        >
          {expandedPrintList.map((itm, idx) => (
            <SingleStickerItem
              key={idx}
              itemData={itm}
              presetConfig={activeConfig}
              visibility={fieldVisibility}
            />
          ))}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-white border-t border-slate-100 flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            {activeConfig.isSheet
              ? `แผ่น A4 (${totalPages} แผ่น | ${labelsPerPage} ป้าย/แผ่น)`
              : `ขนาดกระดาษ ${activeConfig.width} × ${activeConfig.height}`}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold cursor-pointer"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={handlePrint}
              className="h-9 px-4 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              พิมพ์ลาเบล ({expandedPrintList.length} ดวง)
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
