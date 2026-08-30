import { createHmac, timingSafeEqual } from 'crypto'

export interface SsoPayload {
  sub: string
  email: string
  full_name: string
  role: 'admin' | 'staff' | 'viewer'
  department?: string
  photo_url?: string
  iss?: string
  aud: string
  iat: number
  exp: number
  jti?: string
}

export function verifySsoJwt(token: string): { valid: boolean; payload?: SsoPayload; error?: string } {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return { valid: false, error: 'Invalid JWT format' }

    const [headerB64, payloadB64, signatureB64] = parts
    const secret = process.env.SSO_JWT_SECRET
    if (!secret) return { valid: false, error: 'SSO_JWT_SECRET is missing' }

    // 1. Verify Signature
    const data = `${headerB64}.${payloadB64}`
    const expectedSig = createHmac('sha256', secret)
      .update(data)
      .digest('base64url')

    const bufA = Buffer.from(signatureB64)
    const bufB = Buffer.from(expectedSig)
    if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) {
      return { valid: false, error: 'Invalid token signature' }
    }

    // 2. Decode Payload
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8')
    const payload: SsoPayload = JSON.parse(payloadJson)

    // 3. Verify Expiration & Audience
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) return { valid: false, error: 'SSO Token expired' }
    if (payload.aud !== 'camms') return { valid: false, error: 'Invalid audience' }

    return { valid: true, payload }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'JWT verification failed'
    return { valid: false, error: message }
  }
}
