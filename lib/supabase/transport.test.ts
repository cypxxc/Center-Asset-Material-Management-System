import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { instrumentSupabaseFetch } from './transport'

test('transport cancels stalled headers and stalled response bodies', async () => {
  const server = createServer((request, response) => {
    if (request.url === '/rest/v1/body') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.write('{')
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const fetcher = instrumentSupabaseFetch(undefined, { timeoutMs: 100 })
  try {
    for (const path of ['headers', 'body']) {
      await assert.rejects(async () => {
        const response = await fetcher(`http://127.0.0.1:${address.port}/rest/v1/${path}`)
        await response.json()
      }, (error: Error) => ['TimeoutError', 'AbortError'].includes(error.name))
    }
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('transport preserves caller cancellation and forwards successful responses', async () => {
  let calls = 0
  const fetcher = instrumentSupabaseFetch(async () => { calls++; return new Response('ok') })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(fetcher('https://example.com/rest/v1/items', { signal: controller.signal }), { name: 'AbortError' })
  await assert.rejects(fetcher(new Request('https://example.com/rest/v1/items', { signal: controller.signal })), { name: 'AbortError' })
  assert.equal(calls, 0)
  assert.equal(await (await fetcher('https://example.com/rest/v1/items')).text(), 'ok')
  assert.equal(calls, 1)
})
