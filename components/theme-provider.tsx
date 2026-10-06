'use client'

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = 'camms-theme'

let listeners: Array<() => void> = []
function subscribe(listener: () => void) {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

let memoryTheme: Theme | null = null

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const storage = window.localStorage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    const stored = storage?.getItem(STORAGE_KEY) as Theme | null
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      return stored
    }
    if (stored === null && memoryTheme === null) {
      return 'system'
    }
  } catch {
    // Ignore localStorage access failures
  }
  return memoryTheme ?? 'system'
}

export function resetThemeStore() {
  memoryTheme = null
  try {
    const storage = window.localStorage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
    storage?.removeItem(STORAGE_KEY)
  } catch {}
  if (typeof document !== 'undefined') {
    document.documentElement.removeAttribute('data-theme')
  }
  notify()
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function subscribeSystemTheme(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', onStoreChange)
  return () => mediaQuery.removeEventListener('change', onStoreChange)
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getStoredTheme, () => 'system' as Theme)
  const isSystemDark = useSyncExternalStore(subscribeSystemTheme, getSystemDark, () => false)

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system' ? (isSystemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const root = document.documentElement
    if (resolvedTheme === 'dark') {
      root.classList.add('dark')
      root.setAttribute('data-theme', 'dark')
    } else {
      root.classList.remove('dark')
      root.setAttribute('data-theme', 'light')
    }
  }, [resolvedTheme])

  const setTheme = (nextTheme: Theme) => {
    memoryTheme = nextTheme
    try {
      const storage = window.localStorage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
      storage?.setItem(STORAGE_KEY, nextTheme)
    } catch {
      // Ignore localStorage write failures
    }
    notify()
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

const defaultThemeContext: ThemeContextType = {
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
}

export function useTheme() {
  const context = useContext(ThemeContext)
  return context ?? defaultThemeContext
}
