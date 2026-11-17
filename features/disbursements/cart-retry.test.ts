import test from 'node:test'
import assert from 'node:assert/strict'
import { cartRetryPayload, parseCartRetry } from './cart-retry'

test('retry identity is independent of cart selection and object insertion order', () => {
  const first = { item_ids: ['b','a'], quantities: { b: 2,a: 1 }, item_actions: { b: 'issue',a: 'borrow' }, purpose: ' test ', due_date: '2027-01-01', request_type: 'borrow' }
  assert.equal(cartRetryPayload(first), cartRetryPayload({ ...first, item_ids: ['a','b'], quantities: { a: 1,b: 2 }, item_actions: { a: 'borrow',b: 'issue' }, purpose: 'test' }))
})
test('invalid or corrupted persisted retry data is rejected', () => {
  for (const raw of ['no-json','null','true','{}','{"payload":"x","key":"invalid"}']) assert.equal(parseCartRetry(raw), null)
  const value = { payload: 'x', key: 'b201679a-386a-4579-94c0-d0b4f717ef2a' }
  assert.deepEqual(parseCartRetry(JSON.stringify(value)), value)
})
