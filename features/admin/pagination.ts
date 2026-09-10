function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(number)))
}

export function normalizeAdminPagination(page: unknown, pageSize: unknown) {
  const normalizedPage = boundedInteger(page, 1, 1, 100_000)
  const normalizedPageSize = boundedInteger(pageSize, 50, 10, 100)
  const from = (normalizedPage - 1) * normalizedPageSize
  return { page: normalizedPage, pageSize: normalizedPageSize, from, to: from + normalizedPageSize - 1 }
}
