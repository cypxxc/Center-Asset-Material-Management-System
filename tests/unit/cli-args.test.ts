import test from 'node:test'
import assert from 'node:assert/strict'
import { parseCliArgs } from '../../scripts/ai-uat/run'

test('parseCliArgs parses empty arguments as defaults', () => {
  const args = parseCliArgs([])
  assert.equal(args.headed, false)
  assert.equal(args.role, undefined)
  assert.equal(args.scenarioId, undefined)
})

test('parseCliArgs handles role and headed flags', () => {
  const args = parseCliArgs(['--role', 'admin', '--headed', '--url', 'http://localhost:3001'])
  assert.equal(args.role, 'admin')
  assert.equal(args.headed, true)
  assert.equal(args.url, 'http://localhost:3001')
})

test('parseCliArgs handles scenario ID flag', () => {
  const args = parseCliArgs(['--scenario', 'TC-ADM-01'])
  assert.equal(args.scenarioId, 'TC-ADM-01')
})
