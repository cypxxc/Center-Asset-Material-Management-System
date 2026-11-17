import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('queries.ts imports React cache and uses explicit select projections', () => {
  const itemsQueriesPath = path.join(process.cwd(), 'features/items/queries.ts')
  const authQueriesPath = path.join(process.cwd(), 'features/auth/queries.ts')

  assert.ok(fs.existsSync(itemsQueriesPath), 'features/items/queries.ts must exist')
  assert.ok(fs.existsSync(authQueriesPath), 'features/auth/queries.ts must exist')

  const itemsContent = fs.readFileSync(itemsQueriesPath, 'utf8')
  const authContent = fs.readFileSync(authQueriesPath, 'utf8')

  assert.ok(authContent.includes("import { cache } from 'react'"), 'auth/queries.ts must import cache from react')
  assert.ok(authContent.includes("cache("), 'auth/queries.ts must wrap profile query in React cache()')
  assert.ok(!itemsContent.includes(".select('*')"), 'items/queries.ts should avoid wildcard select(*) in main getItems query')
})
