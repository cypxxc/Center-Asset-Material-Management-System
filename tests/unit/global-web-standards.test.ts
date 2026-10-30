import test from 'node:test'
import assert from 'node:assert/strict'
import robots from '../../app/robots'
import manifest from '../../app/manifest'
import { SECURITY_HEADERS } from '../../lib/security-headers'
import { GET as getSecurityTxt } from '../../app/.well-known/security.txt/route'

test('robots.ts disallows indexing for all search crawlers', () => {
  const result = robots()
  assert.deepEqual(result.rules, {
    userAgent: '*',
    disallow: '/',
  })
})

test('manifest.ts provides valid W3C PWA web app manifest', () => {
  const result = manifest()
  assert.equal(result.short_name, 'CAMMS')
  assert.equal(result.display, 'standalone')
  assert.ok(result.icons && result.icons.length > 0)
})

test('SECURITY_HEADERS includes X-Robots-Tag for search engine prevention', () => {
  assert.match(SECURITY_HEADERS['X-Robots-Tag'], /noindex/)
  assert.match(SECURITY_HEADERS['X-Robots-Tag'], /nofollow/)
})

test('security.txt endpoint complies with RFC 9116', async () => {
  const response = await getSecurityTxt()
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') || '', /text\/plain/)
  const body = await response.text()
  assert.match(body, /Contact: mailto:/)
  assert.match(body, /Expires:/)
  assert.match(body, /Canonical:/)
})
