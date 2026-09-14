import '../../tests/setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { mockSupabaseRegistry } from '../../tests/mocks/supabase'
import { getSettingsData } from './queries'

const sections = ['categories', 'locations', 'units'] as const

for (const section of sections) {
  test(`settings ${section} reads only the selected section and matches the all-sections result`, async () => {
    mockSupabaseRegistry.clear()
    for (const table of sections) {
      mockSupabaseRegistry.setTableResponse(table, [{ id: `${table}-1`, name: table }])
    }

    const selected = await getSettingsData(section)
    const selectedQueries = mockSupabaseRegistry.getQueryLog()
    assert.deepEqual(selectedQueries.map((entry) => entry.table), [section])
    assert.equal(selectedQueries[0].clientKind, 'anon')
    for (const other of sections.filter((table) => table !== section)) {
      assert.deepEqual(selected[other], [])
    }

    const all = await getSettingsData()
    assert.deepEqual(selected[section], all[section])
    const allQueries = mockSupabaseRegistry.getQueryLog().slice(1)
    assert.deepEqual(allQueries.map((entry) => entry.table).sort(), [...sections].sort())
    assert.deepEqual(
      allQueries.find((entry) => entry.table === section)?.operations,
      selectedQueries[0].operations,
    )
  })

  test(`settings ${section} keeps the selected-section error private`, async () => {
    mockSupabaseRegistry.clear()
    mockSupabaseRegistry.setTableResponse(section, null, { message: 'private database detail' })
    await assert.rejects(getSettingsData(section), { message: 'Unable to load settings data' })
  })

  test(`all settings identifies ${section} failure without exposing database details`, async () => {
    mockSupabaseRegistry.clear()
    mockSupabaseRegistry.setTableResponse(section, null, { message: 'private database detail' })
    await assert.rejects(getSettingsData(), { message: `Unable to load ${section}` })
  })
}

test('settings returns empty arrays for null data in every mode', async () => {
  mockSupabaseRegistry.clear()
  for (const section of sections) mockSupabaseRegistry.setTableResponse(section, null)
  for (const section of [...sections, 'all'] as const) {
    assert.deepEqual(await getSettingsData(section), { categories: [], locations: [], units: [] })
  }
})
