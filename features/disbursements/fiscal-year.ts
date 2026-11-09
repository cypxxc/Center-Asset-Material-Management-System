const bangkokDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: 'numeric',
})

export function computeThaiFiscalYear(date: Date = new Date()): number {
  const parts = bangkokDateFormatter.formatToParts(date)
  let month = 0
  let year = 0

  for (const part of parts) {
    if (part.type === 'month') month = Number(part.value)
    if (part.type === 'year') year = Number(part.value)
  }

  const thaiYear = year + 543
  return month >= 10 ? thaiYear + 1 : thaiYear
}
