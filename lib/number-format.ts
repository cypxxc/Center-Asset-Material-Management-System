export function stripCommas(value: string | null | undefined): string {
  if (!value) return ''
  return value.toString().replace(/,/g, '')
}

export function formatNumberWithCommas(
  value: string | number | null | undefined,
  allowDecimals = false
): string {
  if (value === null || value === undefined || value === '') return ''
  const str = stripCommas(value.toString())
  if (!str) return ''

  const parts = str.split('.')
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  if (allowDecimals && parts.length > 1) {
    const decimalPart = parts[1].slice(0, 2)
    return `${integerPart}.${decimalPart}`
  }

  return integerPart
}
