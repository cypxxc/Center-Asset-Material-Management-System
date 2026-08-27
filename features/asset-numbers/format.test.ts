import test from 'node:test'
import assert from 'node:assert/strict'
import { getAssetNumberTokens, renderAssetNumber } from './format'
import { AssetNumberTemplate } from './types'

const template: AssetNumberTemplate = {
  id: 'template-1',
  name: 'ตัวอย่าง',
  pattern: '{org}.{group}-{class}-{running:4}-{subclass}/{year:2}',
  field_defaults: { org: 'สขส7', group: '7110', class: '006', subclass: '11', year: '58' },
  is_active: true,
  created_at: '',
  updated_at: '',
}

test('renders an official-style asset number with a padded running number', () => {
  assert.equal(renderAssetNumber(template, {}, 1), 'สขส7.7110-006-0001-11/58')
})

test('lists each template token including running number metadata', () => {
  assert.deepEqual(getAssetNumberTokens(template.pattern), [
    { key: 'org', width: undefined },
    { key: 'group', width: undefined },
    { key: 'class', width: undefined },
    { key: 'running', width: 4 },
    { key: 'subclass', width: undefined },
    { key: 'year', width: 2 },
  ])
})
