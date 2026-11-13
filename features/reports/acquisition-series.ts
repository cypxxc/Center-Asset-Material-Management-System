export interface AcquisitionMonth {
  year: number
  month: number
  recordCount: number
  knownValue: number
  missingPriceCount: number
}

export interface AcquisitionSummary {
  months: AcquisitionMonth[]
  missingDateCount: number
  futureDateCount: number
  asOf: string
}

export type YearConvention = 'calendar' | 'fiscal'
export type AcquisitionMetric = 'count' | 'value'

export interface AcquisitionPeriod {
  key: string
  label: string
  fullLabel: string
  recordCount: number
  knownValue: number
  missingPriceCount: number
  future: boolean
  partial?: boolean
}

export const shortMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const fullMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

function periodYear(year: number, month: number, convention: YearConvention) {
  return year + (convention === 'fiscal' && month >= 10 ? 1 : 0)
}

export function buildAcquisitionSeries(
  summary: AcquisitionSummary,
  convention: YearConvention,
  selectedYear: number | null,
) {
  const [currentYear, currentMonth] = summary.asOf.split('-').map(Number)
  const currentPeriodYear = periodYear(currentYear, currentMonth, convention)
  const availableYears = [...new Set(summary.months.map(m => periodYear(m.year, m.month, convention)))].sort((a, b) => b - a)
  const periods: AcquisitionPeriod[] = []

  if (selectedYear !== null) {
    for (let index = 0; index < 12; index++) {
      const month = convention === 'fiscal' ? (index + 9) % 12 + 1 : index + 1
      const year = selectedYear - (convention === 'fiscal' && month >= 10 ? 1 : 0)
      periods.push({
        key: `${year}-${month}`, label: shortMonths[month - 1],
        fullLabel: `${fullMonths[month - 1]} ${year + 543}`,
        recordCount: 0, knownValue: 0, missingPriceCount: 0,
        future: year * 12 + month > currentYear * 12 + currentMonth,
        partial: year === currentYear && month === currentMonth,
      })
    }
  } else if (availableYears.length) {
    for (let year = availableYears[availableYears.length - 1]; year <= availableYears[0]; year++) {
      periods.push({ key: String(year), label: String(year + 543),
        fullLabel: `${convention === 'fiscal' ? 'ปีงบประมาณ' : 'ปีปฏิทิน'} ${year + 543}`,
        recordCount: 0, knownValue: 0, missingPriceCount: 0, future: year > currentPeriodYear,
        partial: year === currentPeriodYear })
    }
  }

  const byKey = new Map(periods.map(p => [p.key, p]))
  for (const month of summary.months) {
    const year = periodYear(month.year, month.month, convention)
    if (selectedYear !== null && year !== selectedYear) continue
    const period = byKey.get(selectedYear === null ? String(year) : `${month.year}-${month.month}`)
    if (!period || period.future) continue
    period.recordCount += month.recordCount
    period.knownValue += month.knownValue
    period.missingPriceCount += month.missingPriceCount
  }

  const totals = periods.reduce((total, period) => ({
    recordCount: total.recordCount + period.recordCount,
    knownValue: total.knownValue + period.knownValue,
    missingPriceCount: total.missingPriceCount + period.missingPriceCount,
  }), { recordCount: 0, knownValue: 0, missingPriceCount: 0 })
  const conventionLabel = convention === 'fiscal' ? 'ปีงบประมาณ' : 'ปีปฏิทิน'
  const rangeLabel = selectedYear === null
    ? `${conventionLabel} · ทุกปีที่มีข้อมูล (${convention === 'fiscal' ? 'ต.ค.–ก.ย.' : 'ม.ค.–ธ.ค.'})`
    : `${conventionLabel} ${selectedYear + 543} · ${convention === 'fiscal'
      ? `1 ต.ค. ${selectedYear + 542} – 30 ก.ย. ${selectedYear + 543}`
      : `1 ม.ค. ${selectedYear + 543} – 31 ธ.ค. ${selectedYear + 543}`}`

  return { availableYears, periods, totals, rangeLabel,
    ongoing: selectedYear === null ? availableYears.includes(currentPeriodYear) : selectedYear === currentPeriodYear }
}
