import { test } from 'node:test'
import assert from 'node:assert/strict'
import { featureFlags } from '@/lib/feature-flags'

test('featureFlags.isEnabled respects env overrides', () => {
  const prev = process.env.FEATURE_METRICS_ENABLED
  process.env.FEATURE_METRICS_ENABLED = 'false'
  assert.equal(featureFlags.isEnabled('METRICS_ENABLED'), false)
  process.env.FEATURE_METRICS_ENABLED = 'true'
  assert.equal(featureFlags.isEnabled('METRICS_ENABLED'), true)
  if (prev === undefined) delete process.env.FEATURE_METRICS_ENABLED
  else process.env.FEATURE_METRICS_ENABLED = prev
})

test('featureFlags.list returns registry keys', () => {
  const flags = featureFlags.list()
  assert.ok('METRICS_ENABLED' in flags)
})
