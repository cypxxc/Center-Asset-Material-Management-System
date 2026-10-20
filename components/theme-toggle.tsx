'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

const emptySubscribe = () => () => {}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )

  if (!mounted) {
    return (
      <div
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground opacity-50',
          className
        )}
        aria-hidden="true"
      />
    )
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const label =
    theme === 'light'
      ? 'โหมดสว่าง (คลิกเพื่อเปลี่ยนเป็นโหมดมืด)'
      : 'โหมดมืด (คลิกเพื่อเปลี่ยนเป็นโหมดสว่าง)'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className={cn(
        'relative flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:bg-muted hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {resolvedTheme === 'dark' ? (
        <Moon className="h-4 w-4 text-blue-400 transition-transform" />
      ) : (
        <Sun className="h-4 w-4 text-amber-500 transition-transform" />
      )}
    </button>
  )
}
