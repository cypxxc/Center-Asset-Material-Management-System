import test from 'node:test'
import assert from 'node:assert/strict'
import { isStagnant, computeDOMHash } from '../../scripts/ai-uat/agent-driver'
import type { InteractiveElement } from '../../scripts/ai-uat/dom-extractor'

test('isStagnant detects 3 identical DOM hashes in sequence', () => {
  const history = ['hash1', 'hash2', 'hash2', 'hash2']
  assert.equal(isStagnant(history), true)
})

test('isStagnant returns false when state is progressing', () => {
  const history = ['hash1', 'hash2', 'hash3']
  assert.equal(isStagnant(history), false)
})

test('computeDOMHash produces identical hash for same elements and distinct for changed', () => {
  const el1: InteractiveElement[] = [
    { id: 1, tag: 'button', label: 'Save', selector: 'button' },
  ]
  const el2: InteractiveElement[] = [
    { id: 1, tag: 'button', label: 'Save', selector: 'button' },
  ]
  const el3: InteractiveElement[] = [
    { id: 1, tag: 'button', label: 'Delete', selector: 'button' },
  ]
  assert.equal(computeDOMHash(el1), computeDOMHash(el2))
  assert.notEqual(computeDOMHash(el1), computeDOMHash(el3))
})
