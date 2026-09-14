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
  barcodeHeight: string
  codeSize: string
  qrSize: string
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

export const STICKER_PRESETS: Record<StickerSizePreset, PresetConfig> = {
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
    barcodeHeight: "h-7",
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
    barcodeHeight: "h-7",
    codeSize: "text-[10px]",
    qrSize: "h-14 w-14",
  },
}
