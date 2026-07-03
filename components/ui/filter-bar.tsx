"use client"

import * as React from "react"
import { X, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

export interface FilterOption {
  label: string
  value: string
}

export interface FilterGroup {
  name: string
  placeholder: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
}

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  groups: FilterGroup[]
  onResetAll?: () => void
  showReset?: boolean
  chips?: { label: string; onRemove: () => void }[]
}

export function FilterBar({
  groups,
  onResetAll,
  showReset = false,
  chips = [],
  className,
  ...props
}: FilterBarProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      <div className="flex flex-wrap items-center gap-2">
        {groups.map((group) => (
          <select
            key={group.name}
            value={group.value}
            onChange={(e) => group.onChange(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer shadow-sm"
          >
            <option value="">{group.placeholder}</option>
            {group.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}

        {showReset && onResetAll && (
          <button
            type="button"
            onClick={onResetAll}
            className="h-8 flex items-center gap-1.5 px-3 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100/80 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
          >
            <RotateCcw className="h-3 w-3" />
            ล้างตัวกรองทั้งหมด
          </button>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {chips.map((chip, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                className="hover:bg-slate-200 rounded-full p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
