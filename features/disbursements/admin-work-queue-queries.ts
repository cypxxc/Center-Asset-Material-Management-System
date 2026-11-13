import 'server-only'
import { cache } from 'react'
import { getCurrentProfile } from '@/features/auth/queries'
import { withUserDatabase } from '@/lib/postgres/request'
import { adminWorkQueueSql } from './admin-work-queue-sql'
import type { AdminWorkQueueSummary } from './admin-work-queue-types'

export const getAdminWorkQueue = cache(async (): Promise<AdminWorkQueueSummary | null> => {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || profile.role !== 'admin') return null
  return withUserDatabase(async tx => {
    const result = await tx.execute<{ summary: AdminWorkQueueSummary }>(adminWorkQueueSql)
    return result.rows[0].summary
  })
})
