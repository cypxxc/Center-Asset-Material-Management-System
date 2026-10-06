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
    debounceMs = 300,
    className,
    placeholder = "ค้นหารายการ",
    disabled,
    ...props
  }, ref) => {
    const [localValue, setLocalValue] = React.useState(value)
    const [isPending, startTransition] = React.useTransition()
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null)

    React.useEffect(() => {
      setLocalValue(value)
    }, [value])

    React.useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
      }
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setLocalValue(val)

      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      if (debounceMs <= 0) {
        startTransition(() => {
          onChange(val)
        })
      } else {
        timeoutRef.current = setTimeout(() => {
          startTransition(() => {
            onChange(val)
          })
        }, debounceMs)
      }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        setLocalValue("")
        startTransition(() => {
          onChange("")
          if (onClear) onClear()
        })
      } else if (e.key === "Enter") {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        startTransition(() => {
          onChange(localValue)
        })
      }
    }

    const handleClear = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setLocalValue("")
      startTransition(() => {
        onChange("")
        if (onClear) onClear()
      })
    }

    const showLoading = isLoading || isPending

    return (
      <div className="relative flex-1 max-w-sm group">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-foreground transition-colors">
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
            "w-full h-8 pl-9 pr-8 bg-muted/50 border border-input text-foreground rounded-lg text-[11px] placeholder:text-muted-foreground focus:outline-none focus:bg-background focus:border-ring focus:ring-1 focus:ring-ring transition-all disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
          {...props}
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
          {showLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {!showLoading && localValue && (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              aria-label="ล้างคำค้นหา"
              title="ล้างคำค้นหา"
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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

