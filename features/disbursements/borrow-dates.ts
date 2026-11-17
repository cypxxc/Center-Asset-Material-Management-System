export function bangkokCalendarDate(now: Date = new Date()): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function borrowDueDateError(dueDate: string | null | undefined, requestedAt?: string, now: Date = new Date()): string | null {
  // This helper also runs in approval controls; avoid shipping the schema library.
  const parsed = dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? new Date(`${dueDate}T00:00:00Z`) : null
  if (!parsed || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueDate) return 'กรุณาระบุกำหนดส่งคืนในรูปแบบ YYYY-MM-DD'
  if (dueDate < bangkokCalendarDate(now)) return 'กำหนดส่งคืนต้องไม่ก่อนวันปัจจุบัน (เวลากรุงเทพฯ)'
  if (requestedAt && dueDate < bangkokCalendarDate(new Date(requestedAt))) return 'กำหนดส่งคืนต้องไม่ก่อนวันที่ส่งคำขอ'
  return null
}

export function approvalBorrowDueDate(currentDue: string | null, replacementDue?: string, requestedAt?: string, now: Date = new Date()): string {
  if (!replacementDue && (!currentDue || currentDue < bangkokCalendarDate(now))) throw new Error('กำหนดส่งคืนเดิมพ้นกำหนดแล้ว กรุณาระบุและยืนยันกำหนดส่งคืนใหม่ก่อนอนุมัติ')
  const dueDate = replacementDue ?? currentDue
  const error = borrowDueDateError(dueDate, requestedAt, now)
  if (error) throw new Error(error)
  return dueDate!
}
