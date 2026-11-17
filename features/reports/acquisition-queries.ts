import 'server-only'
import { cache } from 'react'
import { withUserDatabase } from '@/lib/postgres/request'
import { acquisitionSummarySql, materialAcquisitionSummarySql } from './acquisition-sql'
import type { AcquisitionSummary } from './acquisition-series'

export const getAcquisitionSummary = cache(async (itemType: 'asset' | 'material' = 'asset'): Promise<AcquisitionSummary> => {
  return withUserDatabase(async tx => {
    const result = await tx.execute<{ summary: AcquisitionSummary }>(itemType === 'material' ? materialAcquisitionSummarySql : acquisitionSummarySql)
    return result.rows[0].summary
  })
})
