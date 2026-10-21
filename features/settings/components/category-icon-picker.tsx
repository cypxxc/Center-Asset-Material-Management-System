'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CATEGORY_ICONS,
  CATEGORY_ICON_MAP,
  renderCategoryIconElement,
} from '@/lib/category-icons'

export interface CategoryIconPickerProps {
  defaultValue?: string | null
  name?: string
  className?: string
  categoryName?: string
  onChange?: (iconName: string) => void
}

export function CategoryIconPicker({
  defaultValue,
  name = 'icon',
  className,
  categoryName,
  onChange,
}: CategoryIconPickerProps) {
  const [selectedIcon, setSelectedIcon] = useState<string>(() => {
    if (defaultValue && CATEGORY_ICON_MAP[defaultValue]) {
      return defaultValue
    }
    return 'Tag'
  })

  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Sync internal state if defaultValue changes externally
  const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue)
  if (defaultValue !== prevDefaultValue) {
    setPrevDefaultValue(defaultValue)
    if (defaultValue && CATEGORY_ICON_MAP[defaultValue]) {
      setSelectedIcon(defaultValue)
    }
  }

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

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

  const filteredIcons = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return CATEGORY_ICONS
    return CATEGORY_ICONS.filter(
      (icon) =>
        icon.name.toLowerCase().includes(q) ||
        icon.label.toLowerCase().includes(q) ||
        icon.category.toLowerCase().includes(q)
    )
  }, [search])

  const handleSelectIcon = (iconName: string) => {
    setSelectedIcon(iconName)
    onChange?.(iconName)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div className={cn('relative inline-block text-left', className)} ref={popoverRef}>
      {/* Hidden input to ensure value is submitted with traditional or server action forms */}
      <input type="hidden" name={name} value={selectedIcon} />

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="เลือกไอคอนหมวดหมู่"
        aria-expanded={isOpen}
        className="flex items-center gap-2 px-3 py-1.5 h-9 rounded-lg border border-input bg-card hover:bg-muted/50 text-card-foreground text-xs font-medium shadow-2xs transition-all focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer w-full justify-between"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
            {renderCategoryIconElement(selectedIcon, categoryName, { className: 'h-3.5 w-3.5' })}
          </span>
          <span className="text-[11px] font-semibold text-foreground truncate">
            {CATEGORY_ICONS.find((i) => i.name === selectedIcon)?.label || selectedIcon}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 max-w-[90vw] rounded-xl border border-border bg-card p-2.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
          {/* Search Bar */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาไอคอน (เช่น คอมพิวเตอร์, รถ, โต๊ะ)..."
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-muted/40 border border-input rounded-lg focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/70"
            />
          </div>

          {/* Icons Grid */}
          <div className="max-h-60 overflow-y-auto space-y-1 pr-0.5">
            {filteredIcons.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                ไม่พบไอคอนที่ตรงกับคำค้นหา
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {filteredIcons.map((item) => {
                  const IconComp = item.component
                  const isSelected = item.name === selectedIcon
                  return (
                    <button
                      key={item.name}
                      type="button"
                      title={`${item.label} (${item.name})`}
                      onClick={() => handleSelectIcon(item.name)}
                      className={cn(
                        'flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs group relative',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs'
                          : 'border-border/60 hover:border-border hover:bg-muted/50 text-foreground'
                      )}
                    >
                      <IconComp className="h-4 w-4 mb-1 shrink-0" />
                      <span className="text-[10px] w-full truncate text-center text-muted-foreground group-hover:text-foreground">
                        {item.name}
                      </span>
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                          <Check className="h-2 w-2" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
