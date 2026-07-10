"use client"

import * as React from "react"
import { Search, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  isLoading?: boolean
  debounceMs?: number
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({
    value,
    onChange,
    onClear,
    isLoading = false,
    debounceMs = 0,
    className,
    placeholder = "ค้นหารายการ",
    disabled,
    ...props
  }, ref) => {
    const [localValue, setLocalValue] = React.useState(value)
    const [prevValue, setPrevValue] = React.useState(value)

    if (value !== prevValue) {
      setPrevValue(value)
      setLocalValue(value)
    }

    const debouncedOnChange = React.useMemo(() => {
      if (debounceMs <= 0) return onChange
      let timeoutId: NodeJS.Timeout
      return (val: string) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          onChange(val)
        }, debounceMs)
      }
    }, [onChange, debounceMs])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setLocalValue(val)
      debouncedOnChange(val)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setLocalValue("")
        onChange("")
        if (onClear) onClear()
      } else if (e.key === "Enter") {
        onChange(localValue)
      }
    }

    const handleClear = () => {
      setLocalValue("")
      onChange("")
      if (onClear) onClear()
    }

    return (
      <div className="relative flex-1 max-w-sm group">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-slate-600 transition-colors">
          <Search className="h-3.5 w-3.5" />
        </div>
        <input
          ref={ref}
          type="text"
          value={localValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full h-8 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-lg text-[11px] placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-1 focus:ring-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
          {...props}
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
          {isLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
          )}
          {!isLoading && localValue && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    )
  }
)
SearchInput.displayName = "SearchInput"
