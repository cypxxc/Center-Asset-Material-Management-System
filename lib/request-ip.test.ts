import test from 'node:test'
import assert from 'node:assert/strict'
import { getTrustedClientIp, normalizeIp } from './request-ip'

test('untrusted headers cannot choose a rate-limit identity', () => {
  assert.equal(getTrustedClientIp(new Headers({ 'x-forwarded-for': '1.2.3.4' }), {}), 'unknown')
})
test('explicit proxy hop count ignores a forged left prefix', () => {
  const env = { TRUSTED_PROXY_MODE: 'forwarded', TRUSTED_PROXY_HOPS: '2' }
  assert.equal(getTrustedClientIp(new Headers({ 'x-forwarded-for': 'spoof, 192.0.2.4, 10.0.0.1' }), env), '192.0.2.4')
  assert.throws(() => getTrustedClientIp(new Headers(), env))
  assert.throws(() => getTrustedClientIp(new Headers(), { ...env, TRUSTED_PROXY_HOPS: '0' }))
})
test('Vercel requires its runtime and accepts only a single overwritten IP', () => {
  const env = { TRUSTED_PROXY_MODE: 'vercel', VERCEL: '1' }
  assert.equal(getTrustedClientIp(new Headers({ 'x-forwarded-for': '192.0.2.5' }), env), '192.0.2.5')
  assert.throws(() => getTrustedClientIp(new Headers({ 'x-forwarded-for': '192.0.2.5, 1.2.3.4' }), env))
  assert.throws(() => getTrustedClientIp(new Headers(), { TRUSTED_PROXY_MODE: 'vercel' }))
})
test('normalizes equivalent IPs and rejects ports, zones and malformed values', () => {
  assert.equal(normalizeIp(' 2001:0DB8:0:0:0:0:0:1 '), '2001:db8::1')
  assert.equal(normalizeIp('::ffff:192.0.2.1'), '192.0.2.1')
  assert.equal(normalizeIp('::ffff:c000:201'), '192.0.2.1')
  for (const value of ['bad', '1.2.3.4:80', '[::1]', 'fe80::1%eth0', '']) assert.equal(normalizeIp(value), null)
})
