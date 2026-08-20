import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'crypto'
import { verifySsoJwt, type SsoPayload } from './jwt'

function makeToken(payload: Partial<SsoPayload>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret)
    .update(`${header}.${payloadB64}`)
    .digest('base64url')
  return `${header}.${payloadB64}.${sig}`
}

describe('verifySsoJwt', () => {
  const secret = 'test-sso-secret-123'
  process.env.SSO_JWT_SECRET = secret

  it('validates a correct token successfully', () => {
    const payload: SsoPayload = {
      sub: 'user-123',
      email: 'test@rmu.ac.th',
      full_name: 'Test User',
      role: 'staff',
      department: 'IT',
      photo_url: 'https://example.com/avatar.jpg',
      iss: 'rmu-campus-x',
      aud: 'camms',
      iat: Math.floor(Date.now() / 1000) - 10,
      exp: Math.floor(Date.now() / 1000) + 300,
      jti: 'random-uuid',
    }

    const token = makeToken(payload, secret)
    const result = verifySsoJwt(token)
    assert.equal(result.valid, true)
    assert.equal(result.payload?.email, 'test@rmu.ac.th')
  })

  it('fails if token is expired', () => {
    const payload: SsoPayload = {
      sub: 'user-123',
      email: 'test@rmu.ac.th',
      full_name: 'Test User',
      role: 'staff',
      iss: 'rmu-campus-x',
      aud: 'camms',
      iat: Math.floor(Date.now() / 1000) - 400,
      exp: Math.floor(Date.now() / 1000) - 100,
      jti: 'random-uuid',
    }

    const token = makeToken(payload, secret)
    const result = verifySsoJwt(token)
    assert.equal(result.valid, false)
    assert.equal(result.error, 'SSO Token expired')
  })

  it('fails if audience is invalid', () => {
    const payload: SsoPayload = {
      sub: 'user-123',
      email: 'test@rmu.ac.th',
      full_name: 'Test User',
      role: 'staff',
      iss: 'rmu-campus-x',
      aud: 'other-app',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
      jti: 'random-uuid',
    }

    const token = makeToken(payload, secret)
    const result = verifySsoJwt(token)
    assert.equal(result.valid, false)
    assert.equal(result.error, 'Invalid audience')
  })
})
