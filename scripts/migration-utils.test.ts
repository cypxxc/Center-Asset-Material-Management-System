import assert from 'node:assert/strict'
import test from 'node:test'

import {
  parseRequestedMigrations,
  splitSqlStatements,
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
