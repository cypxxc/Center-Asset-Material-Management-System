'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ItemListSearchParams } from '@/features/items/types'
import { buildItemsUrl, type ItemsFilterUpdates } from '@/features/items/list-params'

export { buildItemsUrl, type ItemsFilterUpdates }

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
    const isFilterOrSearchOrSortChange =
      updates.q !== undefined ||
      updates.type !== undefined ||
      updates.status !== undefined ||
      updates.category_id !== undefined ||
      updates.location_id !== undefined ||
      updates.sort_by !== undefined ||
      updates.sort_dir !== undefined

    const targetPage = updates.page !== undefined
      ? updates.page
      : (isFilterOrSearchOrSortChange ? '1' : (params.page ?? '1'))

    const nextUrl = buildItemsUrl(pathname, {
      q: updates.q !== undefined ? updates.q : searchVal,
      type: updates.type !== undefined ? updates.type : (params.type ?? ''),
      status: updates.status !== undefined ? updates.status : (params.status ?? ''),
      category_id: updates.category_id !== undefined ? updates.category_id : (params.category_id ?? ''),
      location_id: updates.location_id !== undefined ? updates.location_id : (params.location_id ?? ''),
      page: targetPage,
      sort_by: updates.sort_by !== undefined ? updates.sort_by : (params.sort_by ?? ''),
      sort_dir: updates.sort_dir !== undefined ? updates.sort_dir : (params.sort_dir ?? ''),
    })

    startTransition(() => {
      router.push(nextUrl)
    })
  }

  const handlePageChange = (newPage: number) => {
    handleFilterChange({ page: String(newPage) })
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

    handleFilterChange({ sort_by: field, sort_dir: nextDir, page: '1' })
  }

  const buildHref = (overrides: Partial<ItemsFilterUpdates>) => {
    const isFilterOrSearchOrSortOverride =
      overrides.q !== undefined ||
      overrides.type !== undefined ||
      overrides.status !== undefined ||
      overrides.category_id !== undefined ||
      overrides.location_id !== undefined ||
      overrides.sort_by !== undefined ||
      overrides.sort_dir !== undefined

    const page = overrides.page !== undefined
      ? overrides.page
      : (isFilterOrSearchOrSortOverride ? '1' : (params.page ?? '1'))

    return buildItemsUrl(pathname, {
      ...params,
      ...overrides,
      page,
    })
  }

  return {
    searchVal,
    setSearchVal,
    isPending,
    startTransition,
    handleFilterChange,
    handlePageChange,
    toggleSort,
    buildHref,
  }
}
