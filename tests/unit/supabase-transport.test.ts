import test from 'node:test'
import assert from 'node:assert/strict'
import { instrumentSupabaseFetch } from '../../lib/supabase/transport'
import { metrics, resetMetricsExporter } from '../../lib/metrics'

test('transport counts real calls, preserves responses and does not log URL/credentials', async () => {
  resetMetricsExporter()
  const response = new Response('private body')
  const fetcher = instrumentSupabaseFetch(async () => response)
  assert.equal(await fetcher('https://example.supabase.co/storage/v1/object/sign/item-images/private.png?token=secret', { method: 'POST', headers: { Authorization: 'Bearer secret' } }), response)
  const snapshots = metrics._getMemoryExporter().getSnapshots()
  assert.equal(snapshots.filter(s => s.name === 'supabase.http.requests').length, 1)
  assert.equal(snapshots.find(s => s.name === 'supabase.http.latency')?.labels.service, 'storage')
  assert.ok(!JSON.stringify(snapshots).match(/secret|private.png|private body|example.supabase/))
})

test('failed and aborted calls are measured without changing the error', async () => {
  resetMetricsExporter()
  const error = new Error('offline')
  const fetcher = instrumentSupabaseFetch(async () => { throw error })
  await assert.rejects(fetcher('https://example.supabase.co/auth/v1/user'), value => value === error)
  const snapshot = metrics._getMemoryExporter().getSnapshots().find(s => s.name === 'supabase.http.requests')!
  assert.equal(snapshot.labels.service, 'auth.user')
  assert.equal(snapshot.labels.status, 'network_error')
})
