import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export interface AuditLogsFilterParams {
  q: string
  action: string
  target_table: string
  page: number
  pageSize: number
}

export function buildAuditLogsUrl(
  pathname: string,
  params: {
    q?: string
    action?: string
    target_table?: string
    page?: number
    pageSize?: number
  }
): string {
  const query = new URLSearchParams()
  const q = params.q?.trim()
  if (q) query.set('q', q)
  if (params.action && params.action !== 'all') query.set('action', params.action)
  if (params.target_table && params.target_table !== 'all') query.set('target_table', params.target_table)
  if (params.page !== undefined && params.page > 1) query.set('page', params.page.toString())
  if (params.pageSize !== undefined && params.pageSize !== 50) query.set('pageSize', params.pageSize.toString())

  const queryString = query.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}

export function useAuditLogsFilter(initialSearchParams: AuditLogsFilterParams) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const [searchTerm, setSearchTerm] = useState(initialSearchParams.q)
  const [selectedAction, setSelectedAction] = useState(initialSearchParams.action)
  const [selectedTable, setSelectedTable] = useState(initialSearchParams.target_table)

  const applyFilters = (updates: {
    q?: string
    action?: string
    target_table?: string
    page?: number
    pageSize?: number
  }) => {
    const nextUrl = buildAuditLogsUrl(pathname, {
      q: updates.q !== undefined ? updates.q : searchTerm,
      action: updates.action !== undefined ? updates.action : selectedAction,
      target_table: updates.target_table !== undefined ? updates.target_table : selectedTable,
      page: updates.page !== undefined ? updates.page : 1,
      pageSize: updates.pageSize !== undefined ? updates.pageSize : initialSearchParams.pageSize,
    })

    startTransition(() => {
      router.push(nextUrl)
    })
  }

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    applyFilters({ q: searchTerm, page: 1 })
  }

  const handleResetFilters = () => {
    setSearchTerm('')
    setSelectedAction('all')
    setSelectedTable('all')
    startTransition(() => {
      router.push(pathname)
    })
  }

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  return {
    searchTerm,
    setSearchTerm,
    selectedAction,
    setSelectedAction,
    selectedTable,
    setSelectedTable,
    isPending,
    applyFilters,
    handleSearchSubmit,
    handleResetFilters,
    handleRefresh,
  }
}
