'use client'

import * as React from "react"
import { Printer, X, Tag, ChevronLeft, ChevronRight } from "lucide-react"
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
}

export interface AssetTagModalProps {
  isOpen: boolean
  onClose: () => void
  item?: ItemStickerData
  items?: ItemStickerData[]
}

export type StickerSizePreset = "standard" | "small" | "compact"

interface PresetConfig {
  id: StickerSizePreset
  label: string
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

const PRESETS: Record<StickerSizePreset, PresetConfig> = {
  standard: {
    id: "standard",
    label: "Standard (70×35mm)",
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
}: {
  itemData: ItemStickerData
  presetConfig: PresetConfig
}) {
  const barcodeText = itemData.asset_no || itemData.serial_no || ""
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  const itemUrl = itemData.id
    ? `${baseUrl}/items/${itemData.id}`
    : (itemData.asset_no || itemData.serial_no || "")

  let barcodeData = null
  if (barcodeText) {
    try {
      barcodeData = generateCode128Bars(barcodeText)
    } catch {
      barcodeData = null
    }
  }

  let qrCodeData = null
  if (itemUrl) {
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
      className={`bg-white text-slate-900 border border-slate-900 shadow-md flex flex-col justify-between overflow-hidden box-border page-break-inside-avoid ${presetConfig.padding}`}
    >
      {/* Sticker Header */}
      <div className="border-b border-slate-900 pb-0.5 mb-1 text-center">
        <div className={`font-bold tracking-tight text-slate-900 ${presetConfig.titleSize}`}>
          CAMMS — ระบบบริหารจัดการทรัพย์สิน
        </div>
      </div>

      {/* Sticker Content Area: Dual Column (Left Details + Barcode, Right QR Code) */}
      <div className="flex-1 flex items-stretch justify-between gap-1.5 min-h-0">
        {/* Left Column: Details & Code 128 Barcode */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div className="space-y-0.5">
            <div className={`truncate ${presetConfig.nameSize}`} title={itemData.item_name}>
              {itemData.item_name}
            </div>
            {brandModel && (
              <div className={`truncate text-slate-700 ${presetConfig.metaSize}`}>
                {brandModel}
              </div>
            )}
            {itemData.location_name && (
              <div className={`truncate text-slate-600 ${presetConfig.metaSize}`}>
                สถานที่: {itemData.location_name}
              </div>
            )}
          </div>

          {/* Barcode SVG section */}
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
        </div>

        {/* Right Column: Direct Link QR Code for Mobile Phones */}
        {qrCodeData && (
          <div className="flex flex-col items-center justify-center shrink-0 border-l border-slate-200 pl-1">
            <svg
              viewBox={`0 0 ${qrCodeData.size} ${qrCodeData.size}`}
              className={presetConfig.qrSize}
              role="img"
              aria-label={`QR Code ลิงก์ ${itemUrl}`}
            >
              <path d={qrCodeData.path} fill="black" />
            </svg>
            <span className={`text-[6px] font-bold text-slate-500 tracking-tighter leading-none mt-0.5 uppercase`}>
              มือถือสแกน
            </span>
          </div>
        )}
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

  const itemList: ItemStickerData[] = React.useMemo(() => {
    if (items && items.length > 0) return items
    if (item) return [item]
    return []
  }, [item, items])

  const [prevIsOpen, setPrevIsOpen] = React.useState(isOpen)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    if (isOpen) {
      setCurrentIndex(0)
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

  if (!isOpen || itemList.length === 0) return null

  const presetConfig = PRESETS[selectedPreset]
  const isMultiItem = itemList.length > 1
  const currentItem = itemList[currentIndex] || itemList[0]

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print()
    }
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
            padding: 10px !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 12px !important;
            justify-content: flex-start !important;
          }
          @page {
            size: auto;
            margin: 10mm;
          }
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-tag-modal-title"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <div className="p-1.5 bg-slate-900 text-white rounded-lg">
              <Tag className="h-4 w-4" />
            </div>
            <span id="asset-tag-modal-title">
              พิมพ์ลาเบลติดครุภัณฑ์ {isMultiItem && `(${itemList.length} รายการ)`}
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
        <div className="p-5 space-y-5 bg-slate-50/50 overflow-y-auto">
          {/* Preset Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              ขนาดสติกเกอร์ (Sticker Size)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PRESETS) as StickerSizePreset[]).map((key) => {
                const p = PRESETS[key]
                const isSelected = selectedPreset === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedPreset(key)}
                    className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all text-center cursor-pointer ${
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm font-semibold"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sticker Preview Container */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                ตัวอย่างสติกเกอร์ (Preview — Dual Code)
              </label>
              {isMultiItem && (
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="รายการก่อนหน้า"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span>
                    {currentIndex + 1} / {itemList.length}
                  </span>
                  <button
                    type="button"
                    disabled={currentIndex === itemList.length - 1}
                    onClick={() => setCurrentIndex((prev) => Math.min(itemList.length - 1, prev + 1))}
                    className="p-1 rounded hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="รายการถัดไป"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-200/70 rounded-xl flex items-center justify-center min-h-[200px] border border-slate-300/60 shadow-inner overflow-x-auto">
              <SingleStickerItem itemData={currentItem} presetConfig={presetConfig} />
            </div>
          </div>
        </div>

        {/* Hidden printable container for window.print() */}
        <div id="printable-asset-tag" className="hidden">
          {itemList.map((itm, idx) => (
            <SingleStickerItem key={idx} itemData={itm} presetConfig={presetConfig} />
          ))}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-white border-t border-slate-100 flex items-center justify-end gap-2">
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
            พิมพ์สติกเกอร์ {isMultiItem && `(${itemList.length})`}
          </Button>
        </div>
      </div>
    </div>
  )
}
