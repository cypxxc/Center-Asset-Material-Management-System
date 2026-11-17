import 'server-only'
import { cache } from 'react'
import { withUserDatabase } from '@/lib/postgres/request'
import { completedDisbursementSummarySql } from './completed-disbursement-sql'
import type { CompletedDisbursementSummary } from './completed-disbursement-series'

export const getCompletedDisbursementSummary = cache(async (): Promise<CompletedDisbursementSummary> => {
  return withUserDatabase(async tx => {
    const result = await tx.execute<{ summary: CompletedDisbursementSummary }>(completedDisbursementSummarySql)
    return result.rows[0].summary
  })
})
