export function resolveUniqueProfileEmail(
  rows: Array<{ email: string | null }>,
): string | null {
  if (rows.length !== 1) return null
  return rows[0]?.email ?? null
}
