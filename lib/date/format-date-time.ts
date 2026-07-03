import { THAI_LOCALE, THAI_TIMEZONE } from './thai-date'

export function formatDateTime(dateInput: string | Date | number): string {
  if (!dateInput) return ''
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString(THAI_LOCALE, {
    timeZone: THAI_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
export function formatTime(dateInput: string | Date | number): string {
  if (!dateInput) return ''
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(THAI_LOCALE, {
    timeZone: THAI_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
}
