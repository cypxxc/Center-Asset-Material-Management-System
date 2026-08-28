'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import { AssetNumberTemplate } from '@/features/asset-numbers/types'
import { ReferenceOption } from '@/features/items/types'
import { NewItemSheet } from './new-item-sheet'

const NewItemDialogContext = createContext<(() => void) | null>(null)

interface NewItemDialogProviderProps {
  children: ReactNode
  categories: ReferenceOption[]
  locations: ReferenceOption[]
  units: ReferenceOption[]
  assetNumberTemplates?: AssetNumberTemplate[]
}

interface NewItemDialogTriggerProps {
  children: ReactNode
  className?: string
}

export function useNewItemDialog() {
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
  assetNumberTemplates = [],
}: NewItemDialogProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const openNewItemSheet = useCallback(() => setIsOpen(true), [])
  const closeNewItemSheet = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (searchParams.get('new') !== 'true') return

    openNewItemSheet()

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
      <NewItemSheet
        open={isOpen}
        item={null}
        onClose={closeNewItemSheet}
        onSuccess={handleSuccess}
        categories={categories}
        locations={locations}
        units={units}
        assetNumberTemplates={assetNumberTemplates}
      />
    </NewItemDialogContext.Provider>
  )
}
