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

export function formatDateTime(dateInput: string | Date | number = new Date()): string {
  if (!dateInput) return ''
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleString(THAI_LOCALE, {
    timeZone: THAI_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
] as const

const THAI_MONTH_LOOKUP: Record<string, number> = {
  'ม.ค.': 1, 'มค': 1, 'มกราคม': 1, 'ม.ค': 1,
  'ก.พ.': 2, 'กพ': 2, 'กุมภาพันธ์': 2, 'ก.พ': 2,
  'มี.ค.': 3, 'มีค': 3, 'มีนาคม': 3, 'มี.ค': 3,
  'เม.ย.': 4, 'เมย': 4, 'เมษายน': 4, 'เม.ย': 4,
  'พ.ค.': 5, 'พค': 5, 'พฤษภาคม': 5, 'พ.ค': 5,
  'มิ.ย.': 6, 'มิย': 6, 'มิถุนายน': 6, 'มิ.ย': 6,
  'ก.ค.': 7, 'กค': 7, 'กรกฎาคม': 7, 'ก.ค': 7,
  'ส.ค.': 8, 'สค': 8, 'สิงหาคม': 8, 'ส.ค': 8,
  'ก.ย.': 9, 'กย': 9, 'กันยายน': 9, 'ก.ย': 9,
  'ต.ค.': 10, 'ตค': 10, 'ตุลาคม': 10, 'ต.ค': 10,
  'พ.ย.': 11, 'พย': 11, 'พฤศจิกายน': 11, 'พ.ย': 11,
  'ธ.ค.': 12, 'ธค': 12, 'ธันวาคม': 12, 'ธ.ค': 12,
}

export function parseDateThaiBEToISO(input?: string | number | null): string | null {
  if (!input) return null
  const str = String(input).trim()
  if (!str || str === '-') return null

  // 1. Standard ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number)
    const ceYear = y > 2400 ? y - 543 : y
    return `${ceYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  // 2. Excel numeric serial number (e.g. 44399)
  if (/^\d{5}$/.test(str)) {
    const serial = Number(str)
    if (serial > 20000 && serial < 80000) {
      const date = new Date(Math.round((serial - 25569) * 86400 * 1000))
      if (!isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10)
      }
    }
  }

  // 3. Thai abbreviation date e.g. 22-ก.ค.-64 or 5/พ.ย./67
  const thaiTextMatch = str.match(/^(\d{1,2})[-/\s]([^\d\s/\\-]+)[-/\s](\d{2,4})$/)
  if (thaiTextMatch) {
    const day = Number(thaiTextMatch[1])
    const monthKey = thaiTextMatch[2].trim()
    const month = THAI_MONTH_LOOKUP[monthKey]
    let year = Number(thaiTextMatch[3])
    if (month && day >= 1 && day <= 31) {
      if (year < 100) year += 2500
      const ceYear = year > 2400 ? year - 543 : year
      return `${ceYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  // 4. Standard Slash or Dash with numbers: DD/MM/YYYY or DD/MM/YY
  const slashNumMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (slashNumMatch) {
    const day = Number(slashNumMatch[1])
    const month = Number(slashNumMatch[2])
    let year = Number(slashNumMatch[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      if (year < 100) year += 2500
      const ceYear = year > 2400 ? year - 543 : year
      return `${ceYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }

  // Fallback to Date parser
  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    let year = parsed.getFullYear()
    if (year > 2400) year -= 543
    return `${year}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
  }

  return null
}

export function formatDateThaiBE(dateInput?: string | Date | number | null): string {
  if (!dateInput) return '-'
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return '-'
  const isDateOnly = typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
  const day = isDateOnly ? date.getUTCDate() : date.getDate()
  const monthIdx = isDateOnly ? date.getUTCMonth() : date.getMonth()
  const yearCE = isDateOnly ? date.getUTCFullYear() : date.getFullYear()
  const yearBE2Digits = String((yearCE + 543) % 100).padStart(2, '0')
  return `${day}-${THAI_MONTHS_SHORT[monthIdx]}-${yearBE2Digits}`
}

