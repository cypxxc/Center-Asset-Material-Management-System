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
      padding: "px-3 py-2",
      titleSize: "text-[8.5px]",
      nameSize: "text-[11px] font-bold",
      metaSize: "text-[8.5px]",
      codeSize: "text-[10.5px]",
      qrSize: "h-14 w-14",
    }
  } else if (heightMm >= 35) {
    return {
      padding: "px-2 py-1.5",
      titleSize: "text-[8px]",
      nameSize: "text-[10px] font-bold",
      metaSize: "text-[8px]",
      codeSize: "text-[9.5px]",
      qrSize: "h-12 w-12",
    }
  } else if (heightMm >= 25) {
    return {
      padding: "p-1.5",
      titleSize: "text-[7.5px]",
      nameSize: "text-[9.5px] font-bold",
      metaSize: "text-[7.5px]",
      codeSize: "text-[9px]",
      qrSize: "h-10 w-10",
    }
  } else {
    return {
      padding: "p-1",
      titleSize: "text-[6.5px]",
      nameSize: "text-[8.5px] font-bold",
      metaSize: "text-[6.5px]",
      codeSize: "text-[8px]",
      qrSize: "h-8 w-8",
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
      labelHeight: "55mm",
      gap: "2.5mm 4mm",
      marginTop: 6,
      marginBottom: 6,
      marginLeft: 7,
      marginRight: 7,
    },
    width: "96mm",
    height: "55mm",
    padding: "px-3 py-2",
    titleSize: "text-[8.5px]",
    nameSize: "text-[11px] font-bold",
    metaSize: "text-[8.5px]",
    codeSize: "text-[10.5px]",
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
      labelHeight: "55.0mm",
      gap: "2.5mm 4mm",
      marginTop: 6,
      marginBottom: 6,
      marginLeft: 7,
      marginRight: 7,
    },
    width: "96.0mm",
    height: "55.0mm",
    padding: "px-3 py-2",
    titleSize: "text-[8.5px]",
    nameSize: "text-[11px] font-bold",
    metaSize: "text-[8.5px]",
    codeSize: "text-[10.5px]",
    qrSize: "h-14 w-14",
  },
}
