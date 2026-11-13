import { buildAcquisitionSeries, type AcquisitionMetric, type AcquisitionPeriod, type AcquisitionSummary, type YearConvention } from './acquisition-series'

export interface AcquisitionChange {
  direction: 'up' | 'down' | 'flat'
  percent: number | null
  label: string
}

export function calculateAcquisitionChange(previous: number, current: number): AcquisitionChange {
  if (previous === current) return { direction: 'flat', percent: 0, label: '→ 0%' }
  const direction = current > previous ? 'up' : 'down'
  if (previous === 0) return { direction, percent: null, label: '↑ จาก 0' }
  const percent = (current - previous) / previous * 100
  const magnitude = Math.abs(percent)
  const formatted = magnitude < .1 ? '<0.1' : new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 }).format(magnitude)
  return { direction, percent, label: `${direction === 'up' ? '↑' : '↓'} ${formatted}%` }
}

export function getPeriodChange(previous: AcquisitionPeriod | undefined, current: AcquisitionPeriod, metric: AcquisitionMetric) {
  if (!previous || previous.future || current.future || previous.partial || current.partial) return null
  if (metric === 'value' && (previous.missingPriceCount > 0 || current.missingPriceCount > 0)) return null
  return calculateAcquisitionChange(metric === 'count' ? previous.recordCount : previous.knownValue,
    metric === 'count' ? current.recordCount : current.knownValue)
}

export interface AcquisitionForecast {
  year: number
  value: number
  baselineYear: number
  baselineValue: number
  slope: number
  yearsUsed: number
  trainingStartYear: number
  clamped: boolean
}

export function forecastAcquisitions(summary: AcquisitionSummary, convention: YearConvention, metric: AcquisitionMetric): {
  forecast: AcquisitionForecast | null
  reason: string
} {
  const [year, month] = summary.asOf.split('-').map(Number)
  const currentYear = year + (convention === 'fiscal' && month >= 10 ? 1 : 0)
  const history = buildAcquisitionSeries(summary, convention, null).periods
    .filter(period => Number(period.key) >= currentYear - 5 && Number(period.key) < currentYear)
  if (history.length < 3) return { forecast: null, reason: 'ต้องมีทะเบียนย้อนหลังอย่างน้อย 3 ปีที่สิ้นสุดแล้ว จึงจะคาดการณ์ปีถัดไปได้' }
  const last = history[history.length - 1]
  if (Number(last.key) !== currentYear - 1) return { forecast: null, reason: 'ยังไม่มีข้อมูลถึงปีที่สิ้นสุดล่าสุด จึงงดคาดการณ์' }
  if (metric === 'value' && history.some(period => period.missingPriceCount > 0)) {
    return { forecast: null, reason: 'ราคาในข้อมูลย้อนหลังยังไม่ครบ จึงงดคาดการณ์มูลค่า' }
  }
  // Ordinary least squares with centered year offsets; never train on the ongoing year.
  const firstYear = Number(history[0].key)
  const values = history.map(period => metric === 'count' ? period.recordCount : period.knownValue)
  const offsets = history.map(period => Number(period.key) - firstYear)
  const meanX = offsets.reduce((sum, value) => sum + value, 0) / history.length
  const meanY = values.reduce((sum, value) => sum + value, 0) / history.length
  const denominator = offsets.reduce((sum, value) => sum + (value - meanX) ** 2, 0)
  const slope = offsets.reduce((sum, value, index) => sum + (value - meanX) * (values[index] - meanY), 0) / denominator
  const targetYear = currentYear + 1
  const estimate = meanY + slope * (targetYear - firstYear - meanX)
  const value = metric === 'count' ? Math.round(Math.max(0, estimate)) : Math.round(Math.max(0, estimate) * 100) / 100
  return { forecast: { year: targetYear, value, slope, baselineYear: Number(last.key), baselineValue: values[values.length - 1],
    yearsUsed: history.length, trainingStartYear: firstYear, clamped: estimate < 0 }, reason: '' }
}
