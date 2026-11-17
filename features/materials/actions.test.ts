import test from 'node:test'
import assert from 'node:assert/strict'

test('inline material create/edit validates ledger fields, preserves data, and returns without redirect', async () => {
  let allowed = true
  let saved: unknown[] = []
  let redirects = 0
  const existing = { id: '11111111-1111-4111-8111-111111111111', item_name: 'Paper', quantity: 0, unit_price: 12, metadata_version: 7,
    brand: 'Existing brand', image_url: '', status: 'active' }
  const mocks: Record<string, unknown> = {
    'next/navigation': { redirect: () => { redirects++; throw new Error('Unexpected redirect') } },
    'next/cache': { revalidatePath: () => {} },
    '@/features/items/auth-guard': { requireEditor: async () => allowed ? { profile: { role: 'admin' } } : { error: 'Unauthorized' } },
    '@/features/items/postgres-actions': {
      insertPostgresItem: async (...args: unknown[]) => { saved = args; return { data: { id: existing.id }, error: null } },
      updatePostgresItem: async (...args: unknown[]) => { saved = args; return { error: null } },
    },
    './queries': { getMaterial: async () => existing },
  }
  for (const [name, exports] of Object.entries(mocks)) {
    const filename = require.resolve(name)
    require.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module
  }
  const actions = await import('./actions') as Record<string, unknown>
  assert.equal(typeof actions.saveMaterialInline, 'function')
  const save = actions.saveMaterialInline as (id: string | null, state: null, form: FormData) => Promise<{ error?: string; success?: boolean; itemId?: string }>
  const form = new FormData()
  form.set('item_name', 'Paper'); form.set('quantity', '0'); form.set('unit_price', '12'); form.set('status', 'active')
  form.set('commodity_code', '14111500'); form.set('specification', '80 gsm'); form.set('opening_amount', '0')
  const created = await save(null, null, form)
  assert.equal(created.success, true)
  assert.equal(created.itemId, existing.id)
  assert.equal((saved[0] as { item_type: string }).item_type, 'material')
  assert.equal((saved[1] as { commodity_code: string }).commodity_code, '14111500')
  form.set('quantity', '999')
  form.set('metadata_version', '7')
  const edited = await save(existing.id, null, form)
  assert.equal(edited.success, true)
  assert.equal(saved[0], existing.id)
  assert.equal((saved[1] as { brand: string }).brand, 'Existing brand')
  assert.equal((saved[1] as { quantity: number }).quantity, 0)
  assert.equal((saved[2] as { opening_amount: number }).opening_amount, 0)
  assert.equal(saved[3], 7, 'metadata version comes from the opened form')
  assert.equal(redirects, 0)
  saved = []
  form.set('opening_amount', '-1')
  assert.ok((await save(null, null, form)).error)
  assert.equal(saved.length, 0)
  allowed = false
  assert.equal((await save(null, null, form)).error, 'Unauthorized')
  assert.equal(saved.length, 0)
})
