import test from 'node:test'
import assert from 'node:assert/strict'
import { STICKER_PRESETS } from '../../components/ui/asset-tag-layout'

test('STICKER_PRESETS includes thermal roll presets with isSheet false', () => {
  const thermal50x30 = STICKER_PRESETS['thermal_50x30']
  assert.ok(thermal50x30, 'thermal_50x30 preset should be defined')
  assert.equal(thermal50x30.isSheet, false, 'thermal roll should not be a sheet grid')
  assert.equal(thermal50x30.width, '50mm')
  assert.equal(thermal50x30.height, '30mm')

  const thermal40x20 = STICKER_PRESETS['thermal_40x20']
  assert.ok(thermal40x20, 'thermal_40x20 preset should be defined')
  assert.equal(thermal40x20.isSheet, false)
  assert.equal(thermal40x20.width, '40mm')
  assert.equal(thermal40x20.height, '20mm')

  const thermal70x40 = STICKER_PRESETS['thermal_70x40']
  assert.ok(thermal70x40, 'thermal_70x40 preset should be defined')
  assert.equal(thermal70x40.isSheet, false)
  assert.equal(thermal70x40.width, '70mm')
  assert.equal(thermal70x40.height, '40mm')
})

test('thermal roll presets define compact typography and dimensions', () => {
  const p40 = STICKER_PRESETS['thermal_40x20']
  assert.ok(p40.padding)
  assert.ok(p40.qrSize)
  assert.ok(p40.barcodeHeight)
  assert.ok(p40.titleSize)

  const p50 = STICKER_PRESETS['thermal_50x30']
  assert.ok(p50.padding)
  assert.ok(p50.qrSize)
  assert.ok(p50.barcodeHeight)

  const p70 = STICKER_PRESETS['thermal_70x40']
  assert.ok(p70.padding)
  assert.ok(p70.qrSize)
})
