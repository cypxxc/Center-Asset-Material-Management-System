import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import { POST } from '../../app/api/revalidate/route'

test('revalidation stays disabled without a secret and requires an exact bearer token', async () => {
  const previous = process.env.REVALIDATE_SECRET
  try {
    delete process.env.REVALIDATE_SECRET
    assert.equal((await POST(new Request('http://localhost/api/revalidate', { method: 'POST' }))).status, 404)
    process.env.REVALIDATE_SECRET = 'review-test-secret'
    for (const token of ['', 'Bearer wrong', 'Bearer review-test-secret-extra']) {
      assert.equal((await POST(new Request('http://localhost/api/revalidate', { method: 'POST', headers: { authorization: token } }))).status, 401)
    }
    assert.equal((await POST(new Request('http://localhost/api/revalidate', { method: 'POST', headers: { authorization: 'Bearer review-test-secret' } }))).status, 200)
  } finally {
    if (previous === undefined) delete process.env.REVALIDATE_SECRET
    else process.env.REVALIDATE_SECRET = previous
  }
})
