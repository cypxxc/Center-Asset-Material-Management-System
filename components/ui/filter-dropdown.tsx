'use client'

import React from 'react'
import { DropdownMenu } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption {
  value: string
  label: string
  icon?: React.ReactNode
  colorDot?: string
}

export interface FilterDropdownProps {
  label: string
  ariaLabel: string
  name: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  icon: React.ReactNode
  allLabel?: string
  className?: string
}

export function FilterDropdown({
  label,
  ariaLabel,
  name,
  value,
  options,
  onChange,
  icon,
  allLabel,
  className,
}: FilterDropdownProps) {
  const selectedOption = options.find((opt) => opt.value === value)
  const isActive = Boolean(value)

  return (
    <div className={cn('relative inline-flex items-center min-w-0', className)}>
      {/* Hidden native select for 100% accessibility & automated test compatibility */}
      <select
        name={name}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only max-w-[160px] truncate"
        tabIndex={-1}
      >
        <option value="">{allLabel || `กรองตาม${label}`}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Visual Modern Radix Dropdown */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className={cn(
              'group inline-flex items-center gap-1.5 h-9 rounded-lg border px-3 text-xs font-semibold transition-all duration-150 cursor-pointer shadow-2xs select-none outline-none',
              'focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary',
              isActive
                ? 'bg-primary/10 border-primary/40 text-primary font-bold hover:bg-primary/15'
                : 'bg-card hover:bg-muted/70 text-foreground/80 hover:text-foreground border-input'
            )}
            title={selectedOption ? `${label}: ${selectedOption.label}` : `กรองตาม${label}`}
          >
            <span
              className={cn(
                'shrink-0 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
              )}
            >
              {icon}
            </span>
            <span className="truncate max-w-[130px] sm:max-w-[160px]">
              {selectedOption ? selectedOption.label : `กรองตาม${label}`}
            </span>
            {isActive && (
              <span className="size-1.5 rounded-full bg-primary shrink-0 animate-pulse" />
            )}
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity ml-0.5" />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-50 min-w-[200px] max-w-[280px] max-h-[320px] overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95 motion-reduce:animate-none"
          >
            {/* Clear / All Option */}
            <DropdownMenu.Item
              onSelect={() => onChange('')}
              className={cn(
                'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors outline-none',
                !value
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'hover:bg-muted text-foreground'
              )}
            >
              <span className="truncate">{allLabel || `ทั้งหมด (${label})`}</span>
              {!value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-border/60" />

            {/* Options */}
            {options.map((opt) => {
              const isSelected = value === opt.value
              return (
                <DropdownMenu.Item
                  key={opt.value}
                  onSelect={() => onChange(opt.value)}
                  className={cn(
                    'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors outline-none',
                    isSelected
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'hover:bg-muted text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {opt.colorDot && (
                      <span className={cn('size-2 rounded-full shrink-0', opt.colorDot)} />
                    )}
                    {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </DropdownMenu.Item>
              )
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}
