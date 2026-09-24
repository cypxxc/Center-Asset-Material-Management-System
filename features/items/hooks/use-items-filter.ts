import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ItemListSearchParams } from '@/features/items/types'

export interface ItemsFilterUpdates {
  q?: string
  type?: string
  status?: string
  category_id?: string
  location_id?: string
  page?: string
  sort_by?: string
  sort_dir?: string
}

export function buildItemsUrl(
  pathname: string,
  params: ItemsFilterUpdates
): string {
  const query = new URLSearchParams()
  const q = params.q?.trim()
  if (q) query.set('q', q)
  if (params.type) query.set('type', params.type)
  if (params.status) query.set('status', params.status)
  if (params.category_id) query.set('category_id', params.category_id)
  if (params.location_id) query.set('location_id', params.location_id)
  if (params.sort_by) query.set('sort_by', params.sort_by)
  if (params.sort_dir) query.set('sort_dir', params.sort_dir)

  const serialized = query.toString()
  return serialized ? `${pathname}?${serialized}` : pathname
}

export function useItemsFilter(
  params: ItemListSearchParams,
  pathname: string = '/items'
) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [searchVal, setSearchVal] = useState(params.q ?? '')
  const [prevQ, setPrevQ] = useState(params.q ?? '')

  const currentQ = params.q ?? ''
  if (currentQ !== prevQ) {
    setPrevQ(currentQ)
    setSearchVal(currentQ)
  }

  const handleFilterChange = (updates: ItemsFilterUpdates) => {
    const nextUrl = buildItemsUrl(pathname, {
      q: updates.q !== undefined ? updates.q : searchVal,
      type: updates.type !== undefined ? updates.type : (params.type ?? ''),
      status: updates.status !== undefined ? updates.status : (params.status ?? ''),
      category_id: updates.category_id !== undefined ? updates.category_id : (params.category_id ?? ''),
      location_id: updates.location_id !== undefined ? updates.location_id : (params.location_id ?? ''),
      sort_by: updates.sort_by !== undefined ? updates.sort_by : (params.sort_by ?? ''),
      sort_dir: updates.sort_dir !== undefined ? updates.sort_dir : (params.sort_dir ?? ''),
    })

    startTransition(() => {
      router.push(nextUrl)
    })
  }

  const toggleSort = (field: string) => {
    const currentField = params.sort_by || 'updated_at'
    const currentDir = params.sort_dir || 'desc'

    let nextDir: 'asc' | 'desc' = 'asc'
    if (currentField === field) {
      nextDir = currentDir === 'asc' ? 'desc' : 'asc'
    } else {
      nextDir = field === 'item_name' || field === 'item_type' ? 'asc' : 'desc'
    }

    handleFilterChange({ sort_by: field, sort_dir: nextDir })
  }

  const buildHref = (overrides: Partial<ItemsFilterUpdates>) => {
    return buildItemsUrl(pathname, {
      ...params,
      ...overrides,
    })
  }

  return {
    searchVal,
    setSearchVal,
    isPending,
    startTransition,
    handleFilterChange,
    toggleSort,
    buildHref,
  }
}
