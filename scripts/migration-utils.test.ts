import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  buildAtomicMigrationSql,
  parseRequestedMigrations,
  splitSqlStatements,
  validateAvailableMigrationNumbers,
  validateMigrationOrder,
} from './migration-utils'

const available = ['00029_a.sql', '00030_b.sql', '00031_c.sql']

test('migration selection requires an explicit non-empty list', () => {
  assert.throws(() => parseRequestedMigrations(undefined), /MIGRATION_FILES is required/)
  assert.deepEqual(parseRequestedMigrations('00029_a.sql, 00030_b.sql'), [
    '00029_a.sql',
    '00030_b.sql',
  ])
})

test('migration selection rejects unknown and out-of-order files', () => {
  assert.throws(
    () => validateMigrationOrder(['missing.sql'], available),
    /Migration files not found: missing.sql/,
  )
  assert.throws(
    () => validateMigrationOrder(['00031_c.sql', '00030_b.sql'], available),
    /must be listed in ascending order/,
  )
})

test('migration numbers allow only the historical 00018 pair', () => {
  const legacyPair = [
    '00018_allow_staff_manage_metadata.sql',
    '00018_import_items_bulk_tx_line_errors.sql',
  ]
  assert.doesNotThrow(() =>
    validateAvailableMigrationNumbers([
      ...legacyPair,
      '00019_add_sidebar_order_to_profiles.sql',
    ]),
  )

  assert.throws(
    () => validateAvailableMigrationNumbers(['00032_second.sql', '00032_first.sql']),
    /Duplicate migration number 00032: 00032_first\.sql, 00032_second\.sql/,
  )
  assert.throws(
    () => validateAvailableMigrationNumbers([...legacyPair, '00018_third.sql']),
    /Duplicate migration number 00018: 00018_allow_staff_manage_metadata\.sql, 00018_import_items_bulk_tx_line_errors\.sql, 00018_third\.sql/,
  )
  assert.throws(
    () =>
      validateAvailableMigrationNumbers([
        '00018_allow_staff_manage_metadata.sql',
        '00018_legacy_impostor.sql',
      ]),
    /Duplicate migration number 00018: 00018_allow_staff_manage_metadata\.sql, 00018_legacy_impostor\.sql/,
  )
})

test('migration filenames use a five-digit lowercase SQL format', () => {
  assert.throws(
    () => validateAvailableMigrationNumbers(['32_invalid.sql']),
    /Invalid migration filename: 32_invalid\.sql/,
  )
})

test('SQL splitter preserves dollar-quoted function bodies and removes transaction wrappers', () => {
  const sql = `BEGIN;
CREATE FUNCTION public.sample()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sample() TO authenticated;
COMMIT;`

  assert.deepEqual(splitSqlStatements(sql), [
    `CREATE FUNCTION public.sample()\nRETURNS void LANGUAGE plpgsql AS $$\nBEGIN\n  PERFORM 1;\nEND;\n$$;`,
    'GRANT EXECUTE ON FUNCTION public.sample() TO authenticated;',
  ])
})

test('atomic migration SQL embeds every split statement in one outer block', () => {
  const statements = [
    `CREATE FUNCTION public.sample() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM '$camms_migration_statement_0$'; END; $$;`,
    `INSERT INTO sample(value) VALUES ('$camms_migration_outer$');`,
  ]

  const sql = buildAtomicMigrationSql(statements)
  assert.match(sql, /^DO \$camms_migration_outer_\d+\$/)
  assert.match(sql, /EXECUTE \$camms_migration_statement_\d+\$/)
  for (const statement of statements) assert.ok(sql.includes(statement))
  assert.equal((sql.match(/EXECUTE /g) ?? []).length, statements.length)
})

test('atomic migration SQL rejects an empty statement list and avoids quote collisions', () => {
  assert.throws(() => buildAtomicMigrationSql([]), /at least one SQL statement/i)
  const sql = buildAtomicMigrationSql([`SELECT '$camms_migration_statement_0$'`])
  assert.doesNotMatch(sql, /EXECUTE \$camms_migration_statement_0\$/)
})

test('migration runner sends one atomic RPC call per migration file', () => {
  const source = readFileSync(new URL('./apply-migrations.ts', import.meta.url), 'utf8')
  assert.match(source, /buildAtomicMigrationSql\(statements\)/)
  assert.doesNotMatch(source, /for \(const \[index, sqlQuery\] of statements\.entries\(\)\)/)
  assert.match(source, /rpc\('exec_admin_sql', \{ sql_query: atomicSql \}\)/)
})
