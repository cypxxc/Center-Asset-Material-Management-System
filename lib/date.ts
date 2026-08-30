const THAI_LOCALE = 'th-TH' as const
const THAI_TIMEZONE = 'Asia/Bangkok' as const

export function formatDate(dateInput: string | Date | number = new Date()): string {
  if (!dateInput) return ''
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString(THAI_LOCALE, {
    timeZone: THAI_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
