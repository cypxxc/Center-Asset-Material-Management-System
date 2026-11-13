import 'server-only'
import { cache } from 'react'
import { withUserDatabase } from '@/lib/postgres/request'
import { acquisitionSummarySql } from './acquisition-sql'
import type { AcquisitionSummary } from './acquisition-series'

export const getAcquisitionSummary = cache(async (): Promise<AcquisitionSummary> => {
  return withUserDatabase(async tx => {
    const result = await tx.execute<{ summary: AcquisitionSummary }>(acquisitionSummarySql)
    return result.rows[0].summary
  })
})
