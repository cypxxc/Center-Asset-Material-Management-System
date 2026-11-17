import { buildAcquisitionSeries, type AcquisitionSummary, type YearConvention } from './acquisition-series'

export interface CompletedDisbursementSummary {
  asOf: string
  months: { year: number; month: number; borrowed: number; issued: number }[]
  unrecordedHandoverCount: number
}

export function buildCompletedDisbursementSeries(summary: CompletedDisbursementSummary, convention: YearConvention, selectedYear: number | null) {
  const base: AcquisitionSummary = {
    asOf: summary.asOf, missingDateCount: 0, futureDateCount: 0,
    months: summary.months.map(month => ({ ...month, recordCount: month.borrowed + month.issued, knownValue: 0, missingPriceCount: 0 })),
  }
  const annual = buildAcquisitionSeries(base, convention, null)
  const availableYears = [...new Set([...annual.availableYears, ...(selectedYear === null ? [] : [selectedYear])])].sort((a, b) => b - a)
  const values = new Map<string, { borrowed: number; issued: number }>()
  for (const month of summary.months) {
    if (`${month.year}-${String(month.month).padStart(2, '0')}` > summary.asOf.slice(0, 7)) continue
    const key = selectedYear === null
      ? String(month.year + (convention === 'fiscal' && month.month >= 10 ? 1 : 0))
      : `${month.year}-${month.month}`
    const previous = values.get(key) ?? { borrowed: 0, issued: 0 }
    values.set(key, { borrowed: previous.borrowed + month.borrowed, issued: previous.issued + month.issued })
  }
  const periods = buildAcquisitionSeries(base, convention, selectedYear).periods.map(period => {
    const value = period.future ? undefined : values.get(period.key)
    const borrowed = value?.borrowed ?? 0, issued = value?.issued ?? 0
    return { key: period.key, label: period.label, fullLabel: period.fullLabel, future: period.future,
      borrowed, issued, total: borrowed + issued }
  })
  const totals = periods.reduce((sum, period) => ({ borrowed: sum.borrowed + period.borrowed,
    issued: sum.issued + period.issued, total: sum.total + period.total }), { borrowed: 0, issued: 0, total: 0 })
  return { periods, totals, availableYears,
    rangeLabel: buildAcquisitionSeries(base, convention, selectedYear).rangeLabel }
}

export type CompletedDisbursementPeriod = ReturnType<typeof buildCompletedDisbursementSeries>['periods'][number]
