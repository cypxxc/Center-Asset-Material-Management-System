'use client'

import * as React from "react"
import { Printer, X, Tag, ChevronLeft, ChevronRight, SlidersHorizontal, LayoutGrid, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
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

export type StickerSizePreset = "standard" | "custom_grid"

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
  codeSize: string
  qrSize: string
}

export interface FieldVisibilityConfig {
  showOrg: boolean
  showResponsible: boolean
  showLocation: boolean
  showPrice: boolean
  showQr: boolean
  showCutLines: boolean
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
  codeSize: string
  qrSize: string
} {
  if (heightMm >= 45) {
    return {
      padding: "p-3",
      titleSize: "text-[10px]",
      nameSize: "text-xs font-bold",
      metaSize: "text-[9.5px]",
      codeSize: "text-[10px]",
      qrSize: "h-14 w-14",
    }
  } else if (heightMm >= 35) {
    return {
      padding: "p-2",
      titleSize: "text-[8.5px]",
      nameSize: "text-[10.5px] font-bold",
      metaSize: "text-[8.5px]",
      codeSize: "text-[9px]",
      qrSize: "h-11 w-11",
    }
  } else if (heightMm >= 25) {
    return {
      padding: "p-1.5",
      titleSize: "text-[7.5px]",
      nameSize: "text-[9.5px] font-bold",
      metaSize: "text-[7.5px]",
      codeSize: "text-[8px]",
      qrSize: "h-9 w-9",
    }
  } else {
    return {
      padding: "p-1",
      titleSize: "text-[6.5px]",
      nameSize: "text-[8.5px] font-bold",
      metaSize: "text-[6.5px]",
      codeSize: "text-[7px]",
      qrSize: "h-7 w-7",
    }
  }
}

const PRESETS: Record<StickerSizePreset, PresetConfig> = {
  standard: {
    id: "standard",
    label: "แบบมาตรฐาน (2×5 / 10 ป้ายต่อแผ่น)",
    isSheet: true,
    sheetGrid: {
      cols: 2,
      rows: 5,
      labelWidth: "96mm",
      labelHeight: "54mm",
      gap: "3mm 4mm",
      marginTop: 8,
      marginBottom: 8,
      marginLeft: 6,
      marginRight: 6,
    },
    width: "96mm",
    height: "54mm",
    padding: "p-3",
    titleSize: "text-[10px]",
    nameSize: "text-xs font-bold",
    metaSize: "text-[9.5px]",
    codeSize: "text-[10px]",
    qrSize: "h-14 w-14",
  },
  custom_grid: {
    id: "custom_grid",
    label: "แบบกำหนดเอง (Custom Preset)",
    isSheet: true,
    sheetGrid: {
      cols: 2,
      rows: 5,
      labelWidth: "96.0mm",
      labelHeight: "54.0mm",
      gap: "3mm 4mm",
      marginTop: 8,
      marginBottom: 8,
      marginLeft: 6,
      marginRight: 6,
    },
    width: "96.0mm",
    height: "54.0mm",
    padding: "p-3",
    titleSize: "text-[10px]",
    nameSize: "text-xs font-bold",
    metaSize: "text-[9.5px]",
    codeSize: "text-[10px]",
    qrSize: "h-14 w-14",
  },
}

function SingleStickerItem({
  itemData,
  presetConfig,
  visibility,
  isSheetCell = false,
}: {
  itemData: ItemStickerData
  presetConfig: PresetConfig
  visibility: FieldVisibilityConfig
  isSheetCell?: boolean
}) {
  const referenceText = itemData.asset_no || itemData.serial_no || ""
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  const itemUrl = itemData.id
    ? `${baseUrl}/items/${itemData.id}`
    : (itemData.asset_no || itemData.serial_no || "")

  let qrCodeData = null
  if (visibility.showQr && itemUrl) {
    try {
      qrCodeData = generateQrCodeSvgPath(itemUrl)
    } catch {
      qrCodeData = null
    }
  }

  const brandModel = [itemData.brand, itemData.model].filter(Boolean).join(" ")

  const compact = Number.parseFloat(presetConfig.height) < 35
  const qrPixels = compact ? 40 : Math.min(92, Math.max(52, Number.parseFloat(presetConfig.width) * 1.05))

  return (
    <div
      style={{
        width: isSheetCell ? "100%" : presetConfig.width,
        height: isSheetCell ? "100%" : presetConfig.height,
      }}
      className={`print-tag-card label-card bg-white text-black ${
        visibility.showCutLines
          ? "border border-dashed border-slate-400 cut-guide-dashed"
          : "border border-solid border-slate-900 cut-guide-solid"
      } flex flex-col gap-1.5 overflow-hidden box-border break-inside-avoid min-w-0 max-w-full ${presetConfig.padding}`}
    >
      {visibility.showOrg && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black pb-1.5">
          <span className={`border border-black px-1.5 py-0.5 font-black leading-none tracking-tight ${presetConfig.titleSize}`}>CAMMS</span>
          <span className={`${presetConfig.metaSize} font-medium text-black`}>ทะเบียนทรัพย์สินส่วนกลาง</span>
        </div>
      )}

      <div className="shrink-0 min-w-0">
        <div className={`${presetConfig.metaSize} leading-tight`}>{itemData.asset_no ? "เลขครุภัณฑ์" : "Serial Number"}</div>
        <div className={`mt-0.5 font-mono font-bold leading-tight [overflow-wrap:anywhere] ${compact ? presetConfig.codeSize : referenceText.length > 24 ? "text-[12px]" : "text-[17px]"}`}>
          {referenceText || "ไม่ได้ระบุ"}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-stretch gap-2 border-t border-slate-300 pt-1.5">
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
          <div>
            <div className={`break-words leading-tight font-bold ${compact ? presetConfig.nameSize : "text-[13px]"} line-clamp-2`} title={itemData.item_name}>
              {itemData.item_name}
            </div>
            {brandModel && <div className={`mt-0.5 truncate leading-snug ${presetConfig.metaSize}`}>{brandModel}</div>}
          </div>
          <div className={`space-y-0.5 leading-snug text-black ${presetConfig.metaSize}`}>
            {visibility.showLocation && itemData.location_name && <div className="truncate">สถานที่: {itemData.location_name}</div>}
            {visibility.showResponsible && itemData.responsible_person && <div className="truncate">ผู้รับผิดชอบ: {itemData.responsible_person}</div>}
            {visibility.showPrice && itemData.unit_price != null && <div className="truncate">ราคา: {Number(itemData.unit_price).toLocaleString('th-TH')} บาท</div>}
          </div>
        </div>
        {visibility.showQr && qrCodeData && (
          <div className="flex shrink-0 flex-col items-center justify-center gap-0.5">
            <svg
              viewBox={`-4 -4 ${qrCodeData.size + 8} ${qrCodeData.size + 8}`}
              width={qrPixels}
              height={qrPixels}
              className="bg-white"
              shapeRendering="crispEdges"
              role="img"
              aria-label={`QR Code ลิงก์ ${itemUrl}`}
            >
              <rect x={-4} y={-4} width={qrCodeData.size + 8} height={qrCodeData.size + 8} fill="white" />
              <path d={qrCodeData.path} fill="black" />
            </svg>
            <span className="text-[7px] font-medium leading-tight text-black">สแกนดูรายละเอียด</span>
          </div>
        )}
      </div>
    </div>
  )
}

function StickerSheet({ items, presetConfig, visibility }: {
  items: ItemStickerData[]
  presetConfig: PresetConfig
  visibility: FieldVisibilityConfig
}) {
  const grid = presetConfig.sheetGrid!
  return (
    <div className="a4-sheet print-page-a4" style={{
      width: "210mm", height: "297mm", maxHeight: "297mm", boxSizing: "border-box",
      padding: `${grid.marginTop ?? 8}mm ${grid.marginRight ?? 6}mm ${grid.marginBottom ?? 8}mm ${grid.marginLeft ?? 6}mm`,
      display: "grid",
      gridTemplateColumns: `repeat(${grid.cols}, ${grid.labelWidth})`,
      gridTemplateRows: `repeat(${grid.rows}, ${grid.labelHeight})`,
      gap: grid.gap ?? "3mm 4mm", justifyContent: "center", alignContent: "start",
      overflow: "hidden", background: "white",
    }}>
      {items.map((item, index) => <SingleStickerItem key={index} itemData={item}
        presetConfig={presetConfig} visibility={visibility} isSheetCell />)}
    </div>
  )
}

function ScaledPrintPreview({ widthMm, heightMm, children, testId }: {
  widthMm: number
  heightMm: number
  children: React.ReactNode
  testId?: string
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [availableWidth, setAvailableWidth] = React.useState(420)
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setAvailableWidth(entry.contentRect.width)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])
  // Render at print dimensions first, then scale the complete page uniformly.
  const pixelsPerMm = 96 / 25.4
  const scale = Math.min(1, availableWidth / (widthMm * pixelsPerMm))
  return <div ref={containerRef} data-testid={testId} className="w-full min-w-0 max-w-[420px]">
    <div className="relative mx-auto" style={{ width: widthMm * pixelsPerMm * scale, height: heightMm * pixelsPerMm * scale }}>
      <div className="absolute left-0 top-0 origin-top-left bg-white shadow-sm" style={{ width: `${widthMm}mm`, height: `${heightMm}mm`, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  </div>
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
    cols: 2,
    rows: 5,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 6,
    marginRight: 6,
    gap: 3,
  })

  const [fieldVisibility, setFieldVisibility] = React.useState<FieldVisibilityConfig>({
    showOrg: true,
    showResponsible: false,
    showLocation: true,
    showPrice: false,
    showQr: true,
    showCutLines: true,
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
        label: "แบบกำหนดเอง (Custom Preset)",
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
    <>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          /* Hide EVERYTHING on the page: Navbar, Sidebar, Page Headers, Data Tables, Modals */
          body * {
            visibility: hidden !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            background: white !important;
            color: black !important;
            overflow: visible !important;
          }
          /* Completely hide modal overlays and interactive controls */
          .asset-tag-modal-overlay,
          .asset-tag-modal-overlay * {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }
          /* Only make the printable labels area visible, pinned to top-left (0, 0) */
          #printable-asset-tag,
          #printable-asset-tag * {
            visibility: visible !important;
          }
          #printable-asset-tag {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .a4-sheet,
          .print-page-a4 {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            box-sizing: border-box !important;
            padding: 8mm 6mm !important; /* Minimal top/bottom margin */
            display: grid !important;
            grid-template-columns: repeat(2, 96mm) !important;
            grid-template-rows: repeat(5, 54mm) !important; /* Explicit row height to fill the page */
            gap: 3mm 4mm !important;
            justify-content: center !important;
            align-content: start !important; /* Force content to start right at top padding */
            page-break-after: always !important;
            break-after: page !important;
            overflow: hidden !important;
            background: white !important;
          }
          .a4-sheet:last-child,
          .print-page-a4:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .label-card,
          .print-tag-card {
            width: 96mm !important;
            height: 54mm !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }
          .cut-guide-dashed {
            border: 1px dashed #64748b !important;
          }
          .cut-guide-solid {
            border: 1px solid #0f172a !important;
          }
          ${
            activeConfig.isSheet && selectedPreset === "custom_grid"
              ? `
          .a4-sheet,
          .print-page-a4 {
            padding: ${customGrid.marginTop}mm ${customGrid.marginRight}mm ${customGrid.marginBottom}mm ${customGrid.marginLeft}mm !important;
            grid-template-columns: repeat(${sheetCols}, ${customDimensions.width}mm) !important;
            grid-template-rows: repeat(${sheetRows}, ${customDimensions.height}mm) !important;
            gap: ${customGrid.gap}mm !important;
            justify-content: center !important;
            align-content: start !important;
          }
          .label-card,
          .print-tag-card {
            width: ${customDimensions.width}mm !important;
            height: ${customDimensions.height}mm !important;
          }
          `
              : ""
          }
        }
      `}</style>

      {/* Modal Dialog for Screen */}
      <div
        className="asset-tag-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        onClick={onClose}
      >
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
            {/* Preset Selector - 2 Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  รูปแบบและขนาดลาเบล (Label Preset)
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  กระดาษ A4 สติกเกอร์
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(Object.keys(PRESETS) as StickerSizePreset[]).map((key) => {
                  const p = PRESETS[key]
                  const isSelected = selectedPreset === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedPreset(key)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-all text-left flex flex-col justify-center cursor-pointer ${
                        isSelected
                          ? "border-slate-900 bg-slate-900 text-white shadow-xs font-semibold"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="truncate font-bold">{p.label}</span>
                      <span className={`text-[10.5px] mt-0.5 ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                        {key === "custom_grid"
                          ? `คำนวณตาม Grid: ${(customDimensions.width / 10).toFixed(1)} × ${(customDimensions.height / 10).toFixed(1)} ซม. (${customDimensions.width}×${customDimensions.height} มม.)`
                          : "9.6 × 5.4 ซม. (10 ดวง/แผ่น)"}
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
                    ขนาดต่อดวง: ${(customDimensions.width / 10).toFixed(1)} × ${(customDimensions.height / 10).toFixed(1)} ซม. ({customDimensions.width.toFixed(1)} × {customDimensions.height.toFixed(1)} มม.) | รวม {customGrid.cols * customGrid.rows} ดวง/แผ่น
                  </span>
                </div>

                {/* Columns & Rows Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Columns (1 to 3) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="custom-grid-cols-range" className="font-semibold text-slate-700">
                        จำนวนคอลัมน์ (Columns: 1–3)
                      </label>
                      <span className="font-bold text-slate-900">{customGrid.cols} คอลัมน์</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="custom-grid-cols-range"
                        type="range"
                        min="1"
                        max="3"
                        step="1"
                        value={customGrid.cols}
                        onChange={(e) =>
                          setCustomGrid((prev) => ({
                            ...prev,
                            cols: parseInt(e.target.value, 10) || 1,
                          }))
                        }
                        className="flex-1 accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
                        aria-label="แถบเลื่อนจำนวนคอลัมน์ (1-3)"
                      />
                      <input
                        id="custom-grid-cols-number"
                        type="number"
                        min="1"
                        max="3"
                        value={customGrid.cols}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10)
                          setCustomGrid((prev) => ({
                            ...prev,
                            cols: isNaN(val) ? 1 : Math.max(1, Math.min(3, val)),
                          }))
                        }}
                        className="w-12 h-7 text-center text-xs font-bold border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                        aria-label="ช่องกรอกจำนวนคอลัมน์"
                      />
                    </div>
                  </div>

                  {/* Rows (2 to 10) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label htmlFor="custom-grid-rows-range" className="font-semibold text-slate-700">
                        จำนวนแถว (Rows: 2–10)
                      </label>
                      <span className="font-bold text-slate-900">{customGrid.rows} แถว</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id="custom-grid-rows-range"
                        type="range"
                        min="2"
                        max="10"
                        step="1"
                        value={customGrid.rows}
                        onChange={(e) =>
                          setCustomGrid((prev) => ({
                            ...prev,
                            rows: parseInt(e.target.value, 10) || 2,
                          }))
                        }
                        className="flex-1 accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
                        aria-label="แถบเลื่อนจำนวนแถว (2-10)"
                      />
                      <input
                        id="custom-grid-rows-number"
                        type="number"
                        min="2"
                        max="10"
                        value={customGrid.rows}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10)
                          setCustomGrid((prev) => ({
                            ...prev,
                            rows: isNaN(val) ? 2 : Math.max(2, Math.min(10, val)),
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
                      checked={fieldVisibility.showQr}
                      onChange={() => toggleField("showQr")}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4"
                    />
                    <span>QR Code ลิงก์</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={fieldVisibility.showCutLines}
                      onChange={() => toggleField("showCutLines")}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 h-4 w-4"
                    />
                    <span className="flex items-center gap-1">
                      <span>เส้นประสำหรับตัด</span>
                      <span className="text-[10px] text-slate-400 font-normal">(Cut lines)</span>
                    </span>
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

              <p className="text-xs leading-relaxed text-slate-600">แสดงแบบเดียวกับงานพิมพ์จริง ย่อให้พอดีหน้าจอ • ตอนพิมพ์เลือกขนาดจริง 100% และปิดหัว–ท้ายกระดาษ</p>
              <div className="p-4 sm:p-6 bg-slate-200/70 rounded-xl flex items-center justify-center min-h-[220px] border border-slate-300/60 shadow-inner overflow-x-auto">
                {previewMode === "sheet" && activeConfig.isSheet ? (
                  <ScaledPrintPreview widthMm={210} heightMm={297} testId="a4-sheet-preview">
                    <StickerSheet
                      items={expandedPrintList.slice(safeSheetPageIndex * labelsPerPage, (safeSheetPageIndex + 1) * labelsPerPage)}
                      presetConfig={activeConfig}
                      visibility={fieldVisibility}
                    />
                  </ScaledPrintPreview>
                ) : (
                  <ScaledPrintPreview widthMm={Number.parseFloat(activeConfig.width)} heightMm={Number.parseFloat(activeConfig.height)}>
                    <SingleStickerItem itemData={currentItem} presetConfig={activeConfig} visibility={fieldVisibility} />
                  </ScaledPrintPreview>
                )}
              </div>
            </div>
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

      {/* Hidden printable container for window.print() — Clean sibling element */}
      <div id="printable-asset-tag" className="hidden">
        {activeConfig.isSheet ? (
          Array.from({ length: totalPages }).map((_, pageIdx) => {
            const pageItems = expandedPrintList.slice(
              pageIdx * labelsPerPage,
              (pageIdx + 1) * labelsPerPage
            )
            return (
              <StickerSheet key={pageIdx} items={pageItems} presetConfig={activeConfig} visibility={fieldVisibility} />
            )
          })
        ) : (
          <div className="print-thermal-roll">
            {expandedPrintList.map((itm, idx) => (
              <SingleStickerItem
                key={idx}
                itemData={itm}
                presetConfig={activeConfig}
                visibility={fieldVisibility}
                isSheetCell={false}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
