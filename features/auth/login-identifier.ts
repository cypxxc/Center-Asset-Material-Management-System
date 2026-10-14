const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

export type LoginIdentifierType = 'email' | 'uuid' | 'name'

export function classifyLoginIdentifier(identifier: string): LoginIdentifierType {
  const trimmed = identifier.trim()
  if (trimmed.includes('@')) return 'email'
  if (UUID_REGEX.test(trimmed)) return 'uuid'
  return 'name'
}

export function resolveUniqueProfileEmail(
  rows: Array<{ email: string | null }>,
): string | null {
  if (rows.length !== 1) return null
  return rows[0]?.email ?? null
}

export function resolveUniqueProfileCandidate(
  rows: Array<{ email: string | null; is_active?: boolean | null }>,
): { email: string; is_active: boolean } | null {
  if (rows.length !== 1) return null
  const row = rows[0]
  if (!row?.email) return null
  return {
    email: row.email,
    is_active: row.is_active ?? true,
  }
}
