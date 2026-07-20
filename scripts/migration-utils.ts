export function parseRequestedMigrations(value: string | undefined): string[] {
  const files = value?.split(',').map((file) => file.trim()).filter(Boolean) ?? []
  if (files.length === 0) {
    throw new Error('MIGRATION_FILES is required. Pass an explicit comma-separated migration list.')
  }
  return files
}

const LEGACY_DUPLICATE_MIGRATIONS = new Set([
  '00018_allow_staff_manage_metadata.sql',
  '00018_import_items_bulk_tx_line_errors.sql',
])

export function validateAvailableMigrationNumbers(available: string[]): void {
  const filesByNumber = new Map<string, string[]>()

  for (const file of available) {
    const match = /^(\d{5})_[a-z0-9_]+\.sql$/.exec(file)
    if (!match) throw new Error(`Invalid migration filename: ${file}`)

    const files = filesByNumber.get(match[1]) ?? []
    files.push(file)
    filesByNumber.set(match[1], files)
  }

  for (const [number, files] of filesByNumber) {
    if (files.length < 2) continue

    const isLegacyPair =
      files.length === LEGACY_DUPLICATE_MIGRATIONS.size &&
      files.every((file) => LEGACY_DUPLICATE_MIGRATIONS.has(file))
    if (!isLegacyPair) {
      throw new Error(`Duplicate migration number ${number}: ${files.sort().join(', ')}`)
    }
  }
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
