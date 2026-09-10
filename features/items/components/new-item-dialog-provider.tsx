'use client'

import { createContext, startTransition, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { ReferenceOption } from '@/features/items/types'
import type { NewItemSheet } from './new-item-sheet'

const NewItemDialogContext = createContext<(() => void) | null>(null)

interface NewItemDialogProviderProps {
  children: ReactNode
  categories: ReferenceOption[]
  locations: ReferenceOption[]
  units: ReferenceOption[]
}

interface NewItemDialogTriggerProps {
  children: ReactNode
  className?: string
}

function useNewItemDialog() {
  const openNewItemSheet = useContext(NewItemDialogContext)
  if (!openNewItemSheet) {
    throw new Error('useNewItemDialog must be used within NewItemDialogProvider')
  }
  return openNewItemSheet
}

export function NewItemDialogTrigger({ children, className }: NewItemDialogTriggerProps) {
  const openNewItemSheet = useNewItemDialog()

  return (
    <button type="button" onClick={openNewItemSheet} className={className}>
      {children}
    </button>
  )
}

export function NewItemDialogProvider({
  children,
  categories,
  locations,
  units,
}: NewItemDialogProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [Sheet, setSheet] = useState<typeof NewItemSheet | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const loading = useRef(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const openNewItemSheet = useCallback(async () => {
    if (Sheet) {
      setIsOpen(true)
      return
    }
    if (loading.current) return
    loading.current = true
    setIsLoading(true)
    try {
      const sheetModule = await import('./new-item-sheet')
      setSheet(() => sheetModule.NewItemSheet)
      setIsOpen(true)
    } catch {
      toast('โหลดฟอร์มไม่สำเร็จ กรุณากดเพิ่มรายการเพื่อลองใหม่', 'error')
    } finally {
      loading.current = false
      setIsLoading(false)
    }
  }, [Sheet, toast])
  const closeNewItemSheet = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (searchParams.get('new') !== 'true') return

    startTransition(() => { void openNewItemSheet() })

    const nextSearchParams = new URLSearchParams(searchParams.toString())
    nextSearchParams.delete('new')
    const search = nextSearchParams.toString()
    window.history.replaceState(null, '', `${pathname}${search ? `?${search}` : ''}`)
  }, [openNewItemSheet, pathname, searchParams])

  const handleSuccess = useCallback(() => {
    closeNewItemSheet()
    toast('เพิ่มสิ่งของเรียบร้อยแล้ว', 'success')
    router.refresh()
  }, [closeNewItemSheet, router, toast])

  return (
    <NewItemDialogContext.Provider value={openNewItemSheet}>
      {children}
      {isLoading && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-lg border bg-background px-4 py-3 shadow-lg">กำลังโหลดฟอร์ม…</div>}
      {Sheet && <Sheet
        open={isOpen}
        item={null}
        onClose={closeNewItemSheet}
        onSuccess={handleSuccess}
        categories={categories}
        locations={locations}
        units={units}
      />}
    </NewItemDialogContext.Provider>
  )
}
