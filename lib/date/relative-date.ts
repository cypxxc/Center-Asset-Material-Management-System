import { formatDate } from './format-date'

export function formatRelativeDate(dateInput: string | Date | number): string {
  if (!dateInput) return ''
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return ''
  
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'เมื่อครู่'
  if (diffMins < 60) return `เมื่อ ${diffMins} นาทีที่แล้ว`
  if (diffHours < 24) return `เมื่อ ${diffHours} ชั่วโมงที่แล้ว`
  if (diffDays < 7) return `เมื่อ ${diffDays} วันที่แล้ว`
  
  return formatDate(date)
}
