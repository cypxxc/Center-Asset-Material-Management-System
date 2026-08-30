export function parseRequestedMigrations(value: string | undefined): string[] {
  const files = value?.split(',').map((file) => file.trim()).filter(Boolean) ?? []
  if (files.length === 0) {
    throw new Error('MIGRATION_FILES is required. Pass an explicit comma-separated migration list.')
  }
  return files
}

const HISTORICAL_DUPLICATE_MIGRATIONS = new Map<string, Set<string>>([
  ['00003', new Set(['00003_performance_indexes.sql', '00003_rls_policies.sql'])],
  ['00018', new Set(['00018_allow_staff_manage_metadata.sql', '00018_import_items_bulk_tx_line_errors.sql'])],
  ['00028', new Set(['00028_audit_system_hardening.sql', '00028_revoke_authenticated_admin_sql.sql'])],
  ['00033', new Set(['00033_add_sso_profile_fields.sql', '00033_hot_path_performance_indexes.sql'])],
])

export function validateAvailableMigrationNumbers(available: string[]): void {
  const filesByNumber = new Map<string, string[]>()

  for (const file of available) {
    const match = /^(\d{5}|\d{14})_[a-z0-9_]+\.sql$/.exec(file)
    if (!match) throw new Error(`Invalid migration filename: ${file}`)

    const files = filesByNumber.get(match[1]) ?? []
    files.push(file)
    filesByNumber.set(match[1], files)
  }

  for (const [number, files] of filesByNumber) {
    if (files.length < 2) continue

    const historicalPair = HISTORICAL_DUPLICATE_MIGRATIONS.get(number)
    const isExactHistoricalPair =
      historicalPair !== undefined &&
      files.length === historicalPair.size &&
      files.every((file) => historicalPair.has(file))
    if (!isExactHistoricalPair) {
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

function collisionSafeDollarTag(prefix: string, values: string[]): string {
  let suffix = 0
  while (values.some((value) => value.includes(`$${prefix}_${suffix}$`))) suffix += 1
  return `$${prefix}_${suffix}$`
}

export function buildAtomicMigrationSql(statements: string[]): string {
  if (statements.length === 0) throw new Error('Atomic migration requires at least one SQL statement')

  const executions = statements.map((statement) => {
    const tag = collisionSafeDollarTag('camms_migration_statement', [statement])
    return `  EXECUTE ${tag}${statement}${tag};`
  })
  const body = `BEGIN\n${executions.join('\n')}\nEND;`
  const outerTag = collisionSafeDollarTag('camms_migration_outer', [body, ...statements])
  return `DO ${outerTag}\n${body}\n${outerTag};`
}
