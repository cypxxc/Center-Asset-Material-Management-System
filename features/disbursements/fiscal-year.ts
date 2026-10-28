export function computeThaiFiscalYear(date: Date = new Date()): number {
  const month = date.getMonth() + 1
  const year = date.getFullYear() + 543
  return month >= 10 ? year + 1 : year
}
