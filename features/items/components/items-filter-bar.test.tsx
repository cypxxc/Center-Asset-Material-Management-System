import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ItemsFilterBar, type ItemsFilterBarProps } from './items-filter-bar'

const defaults: ItemsFilterBarProps = {
  searchVal: '', onSearchChange() {}, onSearchClear() {}, params: {},
  categories: [], locations: [], onFilterChange() {}, onResetFilters() {}, localItemsCount: 0,
}

for (const type of ['asset', 'material'] as const) {
  test(`${type} registry does not show its fixed type as an active filter`, () => {
    const html = renderToStaticMarkup(<ItemsFilterBar {...defaults} assetOnly={type === 'asset'} materialOnly={type === 'material'} params={{ type }} />)
    assert.ok(!html.includes('active-filter-chips'))
    assert.ok(!html.includes('name="type"'))
  })
}

test('registry still displays user-selected filters', () => {
  const html = renderToStaticMarkup(<ItemsFilterBar {...defaults} assetOnly params={{ type: 'asset', status: 'active' }} />)
  assert.ok(html.includes('active-chip-status'))
  assert.ok(!html.includes('active-chip-type'))
})

test('mixed inventory retains its selected type filter', () => {
  const html = renderToStaticMarkup(<ItemsFilterBar {...defaults} params={{ type: 'asset' }} />)
  assert.ok(html.includes('active-chip-type'))
})
