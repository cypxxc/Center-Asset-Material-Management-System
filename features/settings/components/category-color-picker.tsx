'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Pipette } from 'lucide-react'
import { cn } from '@/lib/utils'

export const PRESET_COLORS = [
  '#64748B', '#EF4444', '#F97316', '#F59E0B',
  '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7',
  '#D946EF', '#EC4899', '#F43F5E', '#78716C',
] as const

export interface CategoryColorPickerProps {
  defaultValue?: string | null
  name?: string
  className?: string
  onChange?: (color: string) => void
}

export function CategoryColorPicker({
  defaultValue,
  name = 'color',
  className,
  onChange,
}: CategoryColorPickerProps) {
  const initialColor =
    defaultValue && /^#[0-9A-Fa-f]{6}$/.test(defaultValue)
      ? defaultValue.toUpperCase()
      : '#64748B'

  const [color, setColor] = useState<string>(initialColor)
  const [hexInput, setHexInput] = useState<string>(initialColor)
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const nativeColorInputRef = useRef<HTMLInputElement>(null)

  // Sync internal state when defaultValue changes externally
  useEffect(() => {
    if (defaultValue && /^#[0-9A-Fa-f]{6}$/.test(defaultValue)) {
      const normalized = defaultValue.toUpperCase()
      setColor(normalized)
      setHexInput(normalized)
    }
  }, [defaultValue])

  // Close popup when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleColorChange = (newColor: string) => {
    const formatted = newColor.toUpperCase()
    setColor(formatted)
    setHexInput(formatted)
    onChange?.(formatted)
  }

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.toUpperCase()
    setHexInput(rawVal)
    if (/^#[0-9A-F]{6}$/i.test(rawVal)) {
      setColor(rawVal)
      onChange?.(rawVal)
    }
  }

  const handleHexBlur = () => {
    if (!/^#[0-9A-F]{6}$/i.test(hexInput)) {
      // Revert to valid current color if invalid
      setHexInput(color)
    }
  }

  return (
    <div className={cn('relative inline-block text-left', className)} ref={popoverRef}>
      {/* Hidden input for HTML form submission */}
      <input type="hidden" name={name} value={color} />

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-2.5 py-1 text-xs text-card-foreground shadow-2xs hover:bg-muted/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all cursor-pointer"
        aria-label={`เลือกสี: ${color}`}
        aria-expanded={isOpen}
      >
        <span
          className="h-4 w-4 rounded-full border border-black/10 shrink-0 shadow-2xs"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className="font-mono text-xs font-medium text-foreground">{color}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-0.5" />
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-60 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="text-[11px] font-semibold text-muted-foreground mb-2">
            สีประจำหมวดหมู่ (16 สียอดนิยม)
          </div>

          {/* Preset Swatches Grid */}
          <div className="grid grid-cols-8 gap-1.5 mb-3">
            {PRESET_COLORS.map((preset) => {
              const isSelected = color.toUpperCase() === preset.toUpperCase()
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleColorChange(preset)}
                  className="group relative flex h-6 w-6 items-center justify-center rounded-md border border-black/10 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  style={{ backgroundColor: preset }}
                  title={preset}
                  aria-label={preset}
                >
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] stroke-[2.5]" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="border-t border-border pt-2.5">
            <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
              กำหนดสีเอง (Custom Color)
            </div>
            <div className="flex items-center gap-2">
              {/* Native color picker button/wrapper */}
              <button
                type="button"
                onClick={() => nativeColorInputRef.current?.click()}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-input bg-card hover:bg-muted cursor-pointer shrink-0"
                title="เลือกจากวงล้อสี (Color Wheel)"
              >
                <span
                  className="h-5 w-5 rounded-md border border-black/10"
                  style={{ backgroundColor: color }}
                />
                <input
                  ref={nativeColorInputRef}
                  type="color"
                  value={color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="วงล้อสี"
                />
              </button>

              {/* Hex Input */}
              <div className="relative flex-1">
                <Pipette className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={hexInput}
                  onChange={handleHexInputChange}
                  onBlur={handleHexBlur}
                  maxLength={7}
                  placeholder="#64748B"
                  className="h-8 w-full rounded-lg border border-input bg-card pl-8 pr-2 font-mono text-xs text-foreground uppercase focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                  aria-label="รหัสสี Hex"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
