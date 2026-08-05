'use client'

import * as React from "react"
import { Printer, X, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { generateCode128Bars } from "@/lib/barcode"

export interface ItemStickerData {
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
  item: ItemStickerData
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
}

const PRESETS: Record<StickerSizePreset, PresetConfig> = {
  standard: {
    id: "standard",
    label: "Standard (70×35mm)",
    width: "70mm",
    height: "35mm",
    padding: "p-3",
    titleSize: "text-[10px]",
    nameSize: "text-xs font-bold",
    metaSize: "text-[10px]",
    barcodeHeight: "h-8",
    codeSize: "text-[11px]",
  },
  small: {
    id: "small",
    label: "Small (50×25mm)",
    width: "50mm",
    height: "25mm",
    padding: "p-2",
    titleSize: "text-[8px]",
    nameSize: "text-[10px] font-bold",
    metaSize: "text-[8px]",
    barcodeHeight: "h-6",
    codeSize: "text-[9px]",
  },
  compact: {
    id: "compact",
    label: "Compact (40×20mm)",
    width: "40mm",
    height: "20mm",
    padding: "p-1.5",
    titleSize: "text-[7px]",
    nameSize: "text-[9px] font-bold",
    metaSize: "text-[7px]",
    barcodeHeight: "h-5",
    codeSize: "text-[8px]",
  },
}

export function AssetTagModal({
  isOpen,
  onClose,
  item,
}: AssetTagModalProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<StickerSizePreset>("standard")

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

  if (!isOpen) return null

  const presetConfig = PRESETS[selectedPreset]
  const barcodeText = item.asset_no || item.serial_no || ""

  let barcodeData = null
  if (barcodeText) {
    try {
      barcodeData = generateCode128Bars(barcodeText)
    } catch {
      barcodeData = null
    }
  }

  const brandModel = [item.brand, item.model].filter(Boolean).join(" ")

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
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 1px solid #000 !important;
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: auto;
            margin: 0;
          }
        }
      `}</style>

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-tag-modal-title"
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <div className="p-1.5 bg-slate-900 text-white rounded-lg">
              <Tag className="h-4 w-4" />
            </div>
            <span id="asset-tag-modal-title">พิมพ์ลาเบลติดครุภัณฑ์</span>
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
        <div className="p-5 space-y-5 bg-slate-50/50">
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
            <label className="text-xs font-semibold text-slate-700">
              ตัวอย่างสติกเกอร์ (Preview)
            </label>
            <div className="p-6 bg-slate-200/70 rounded-xl flex items-center justify-center min-h-[200px] border border-slate-300/60 shadow-inner">
              {/* Printable Sticker Box */}
              <div
                id="printable-asset-tag"
                style={{
                  width: presetConfig.width,
                  height: presetConfig.height,
                }}
                className={`bg-white text-slate-900 border border-slate-900 shadow-md flex flex-col justify-between overflow-hidden box-border ${presetConfig.padding}`}
              >
                {/* Sticker Header */}
                <div className="border-b border-slate-900 pb-0.5 mb-1 text-center">
                  <div className={`font-bold tracking-tight text-slate-900 ${presetConfig.titleSize}`}>
                    ทรัพย์สินศูนย์ / CENTER ASSET
                  </div>
                </div>

                {/* Sticker Content */}
                <div className="flex-1 flex flex-col justify-between min-h-0">
                  <div className="space-y-0.5">
                    <div className={`truncate ${presetConfig.nameSize}`} title={item.item_name}>
                      {item.item_name}
                    </div>
                    {brandModel && (
                      <div className={`truncate text-slate-700 ${presetConfig.metaSize}`}>
                        {brandModel}
                      </div>
                    )}
                    {item.location_name && (
                      <div className={`truncate text-slate-600 ${presetConfig.metaSize}`}>
                        สถานที่: {item.location_name}
                      </div>
                    )}
                  </div>

                  {/* Barcode SVG section */}
                  <div className="mt-1 flex flex-col items-center justify-center">
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
                          className={`font-mono font-bold text-slate-900 leading-tight ${presetConfig.codeSize} tracking-wider`}
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
              </div>
            </div>
          </div>
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
            พิมพ์สติกเกอร์
          </Button>
        </div>
      </div>
    </div>
  )
}
