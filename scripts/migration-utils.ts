export function parseRequestedMigrations(value: string | undefined): string[] {
  const files = value?.split(',').map((file) => file.trim()).filter(Boolean) ?? []
  if (files.length === 0) {
    throw new Error('MIGRATION_FILES is required. Pass an explicit comma-separated migration list.')
  }
  return files
}

export function validateMigrationOrder(requested: string[], available: string[]) {
  const missing = requested.filter((file) => !available.includes(file))
  if (missing.length > 0) {
    throw new Error(`Migration files not found: ${missing.join(', ')}`)
  }

  const sorted = [...requested].sort()
  if (requested.some((file, index) => file !== sorted[index])) {
    throw new Error('MIGRATION_FILES must be listed in ascending order')
  }

  if (new Set(requested).size !== requested.length) {
    throw new Error('MIGRATION_FILES must not contain duplicates')
  }
}

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let dollarTag: string | null = null

  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!dollarTag && /^(BEGIN|COMMIT|ROLLBACK);$/i.test(trimmed)) continue

    current += `${line}\n`
    const tags = line.match(/\$[A-Za-z0-9_]*\$/g) ?? []
    for (const tag of tags) {
      if (!dollarTag) dollarTag = tag
      else if (tag === dollarTag) dollarTag = null
    }

    if (!dollarTag && trimmed.endsWith(';')) {
      statements.push(current.trim())
      current = ''
    }
  }

  if (current.trim()) statements.push(current.trim())
  return statements
}
