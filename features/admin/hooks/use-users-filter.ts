import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export interface UsersFilterParams {
  q: string
  role: string
  is_active: string
  page: number
  pageSize: number
}

export function buildUsersUrl(
  pathname: string,
  params: {
    q?: string
    role?: string
    is_active?: string
    page?: number
    pageSize?: number
  }
): string {
  const query = new URLSearchParams()
  const q = params.q?.trim()
  if (q) query.set('q', q)
  if (params.role && params.role !== 'all') query.set('role', params.role)
  if (params.is_active && params.is_active !== 'all') query.set('is_active', params.is_active)
  if (params.page !== undefined && params.page > 1) query.set('page', params.page.toString())
  if (params.pageSize !== undefined && params.pageSize !== 50) query.set('pageSize', params.pageSize.toString())

  const queryString = query.toString()
  return queryString ? `${pathname}?${queryString}` : pathname
}

export function useUsersFilter(initialSearchParams: UsersFilterParams) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const [searchTerm, setSearchTerm] = useState(initialSearchParams.q)
  const [selectedRole, setSelectedRole] = useState(initialSearchParams.role)
  const [selectedStatus, setSelectedStatus] = useState(initialSearchParams.is_active)

  const applyFilters = (updates?: {
    q?: string
    role?: string
    is_active?: string
    page?: number
    pageSize?: number
  }) => {
    const nextUrl = buildUsersUrl(pathname, {
      q: updates?.q !== undefined ? updates.q : searchTerm,
      role: updates?.role !== undefined ? updates.role : selectedRole,
      is_active: updates?.is_active !== undefined ? updates.is_active : selectedStatus,
      page: updates?.page !== undefined ? updates.page : 1,
      pageSize: updates?.pageSize !== undefined ? updates.pageSize : initialSearchParams.pageSize,
    })

    startTransition(() => {
      router.push(nextUrl)
    })
  }

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    applyFilters({ q: searchTerm, page: 1 })
  }

  const handleClearFilters = () => {
    setSearchTerm('')
    setSelectedRole('all')
    setSelectedStatus('all')
    startTransition(() => {
      router.push(pathname)
    })
  }

  return {
    searchTerm,
    setSearchTerm,
    selectedRole,
    setSelectedRole,
    selectedStatus,
    setSelectedStatus,
    isPending,
    startTransition,
    applyFilters,
    handleSearchSubmit,
    handleClearFilters,
  }
}
