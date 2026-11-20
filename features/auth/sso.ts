import 'server-only'
import {
  createHmac,
  createVerify,
  createPublicKey,
  timingSafeEqual,
  type KeyObject,
} from 'node:crypto'
import { sql } from 'drizzle-orm'
import { getAuthDatabase } from '@/lib/postgres/db'
import { createSessionForUserId, setSessionCookie, type LocalProfile } from '@/lib/postgres/session'

export type SSOAlgorithm = 'RS256' | 'HS256'

export type SSOConfig = {
  enabled: boolean
  algorithm: SSOAlgorithm
  issuer: string
  audience: string
  secret?: string
  publicKey?: string
  jwksUri?: string
  clockToleranceSec: number
}

export type SSOClaims = {
  iss: string
  aud: string | string[]
  sub: string
  exp: number
  nbf?: number
  iat?: number
  jti: string
  email?: string
  name?: string
  [key: string]: unknown
}

export type SSOAuthResult =
  | { success: true; profile: LocalProfile }
  | {
      success: false
      code:
        | 'SSO_DISABLED'
        | 'INVALID_CONFIG'
        | 'INVALID_TOKEN'
        | 'ALGORITHM_MISMATCH'
        | 'SIGNATURE_INVALID'
        | 'TOKEN_EXPIRED'
        | 'CLAIM_INVALID'
        | 'REPLAY_DETECTED'
        | 'USER_NOT_MAPPED'
        | 'ACCOUNT_DEACTIVATED'
        | 'SESSION_ERROR'
      message: string
    }

// In-memory cache for JWKS keys: cacheKey -> { key: KeyObject; expiresAt: number }
const JWKS_CACHE = new Map<string, { key: KeyObject; expiresAt: number }>()
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes cache
let lastJwksFetchTimestamp = 0
const JWKS_FETCH_COOLDOWN_MS = 10 * 1000 // Rate limit fresh JWKS fetches to at most 1 per 10s

type JWKKey = {
  kty?: string
  use?: string
  alg?: string
  kid?: string
  n?: string
  e?: string
  [key: string]: unknown
}

/**
 * Checks whether a hostname belongs to private, loopback, or cloud link-local address spaces.
 * Used to prevent SSRF vulnerabilities when contacting JWKS endpoints.
 */
function isDisallowedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal')) {
    return true
  }
  // IPv4 Loopback
  if (/^127\./.test(lower)) return true
  // IPv4 Private networks (RFC 1918)
  if (/^10\./.test(lower)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) return true
  if (/^192\.168\./.test(lower)) return true
  // IPv4 Link-local / Cloud metadata service (169.254.169.254)
  if (/^169\.254\./.test(lower)) return true
  // Current network (0.0.0.0/8)
  if (/^0\./.test(lower)) return true
  // IPv6 Loopback and Unique Local
  if (lower === '::1' || lower === '[::1]' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
    return true
  }
  return false
}

/**
 * Validates that a JWKS URI is strictly HTTPS and does not point to internal/disallowed IP addresses.
 */
function validateJWKSUri(uriString: string): string | null {
  try {
    const url = new URL(uriString)
    if (url.protocol !== 'https:') {
      return null
    }
    if (isDisallowedHost(url.hostname)) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Loads and validates SSO configuration from server environment variables.
 * Returns null if SSO is disabled or configuration is incomplete/invalid.
 */
export function getSSOConfig(): SSOConfig | null {
  const enabled = process.env.SSO_ENABLED === 'true' || process.env.SSO_ENABLED === '1'
  if (!enabled) return null

  const algorithm = process.env.SSO_JWT_ALGORITHM as SSOAlgorithm
  if (algorithm !== 'RS256' && algorithm !== 'HS256') {
    return null
  }

  const issuer = process.env.SSO_JWT_ISSUER?.trim()
  const audience = process.env.SSO_JWT_AUDIENCE?.trim()
  if (!issuer || !audience) {
    return null
  }

  const secret = process.env.SSO_JWT_SECRET?.trim()
  const publicKey = process.env.SSO_JWT_PUBLIC_KEY?.trim()
  const rawJwksUri = process.env.SSO_JWKS_URI?.trim()
  const jwksUri = rawJwksUri ? validateJWKSUri(rawJwksUri) : undefined

  if (algorithm === 'HS256' && !secret) {
    return null
  }

  if (algorithm === 'RS256') {
    if (!publicKey && !jwksUri) {
      return null
    }
  }

  const clockToleranceSec = Math.max(0, parseInt(process.env.SSO_CLOCK_TOLERANCE_SEC ?? '60', 10) || 60)

  return {
    enabled: true,
    algorithm,
    issuer,
    audience,
    secret,
    publicKey,
    jwksUri: jwksUri ?? undefined,
    clockToleranceSec,
  }
}

export function isSSOConfigured(): boolean {
  return getSSOConfig() !== null
}

function base64UrlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64')
}

/**
 * Resolves RSA public key for verification.
 * Enforces kty=RSA, use=sig, alg=RS256 and parameter presence (n, e).
 * Rejects ambiguous keys when kid is omitted.
 * Uses redirect: 'error' to prevent SSRF redirection.
 */
async function resolvePublicKey(config: SSOConfig, kid?: string): Promise<KeyObject | null> {
  if (config.publicKey) {
    try {
      return createPublicKey(config.publicKey)
    } catch {
      return null
    }
  }

  if (!config.jwksUri) return null

  const cacheKey = `${config.jwksUri}:${kid ?? 'default'}`
  const cached = JWKS_CACHE.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key
  }

  // Prevent JWKS endpoint flooding (Cache Stampede)
  const now = Date.now()
  if (now - lastJwksFetchTimestamp < JWKS_FETCH_COOLDOWN_MS && cached) {
    return cached.key
  }
  lastJwksFetchTimestamp = now

  try {
    const res = await fetch(config.jwksUri, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'error', // Reject redirects to prevent SSRF bypass
      next: { revalidate: 600 },
    })

    if (!res.ok) return null
    const data = (await res.json()) as { keys?: JWKKey[] }
    if (!Array.isArray(data.keys) || data.keys.length === 0) return null

    // Filter valid RSA signature keys only
    const validRsaKeys = data.keys.filter((k) => {
      if (k.kty !== 'RSA') return false
      if (k.use && k.use !== 'sig') return false
      if (k.alg && k.alg !== 'RS256') return false
      if (typeof k.n !== 'string' || !k.n || typeof k.e !== 'string' || !k.e) return false
      return true
    })

    if (validRsaKeys.length === 0) return null

    let targetKey: JWKKey | undefined
    if (kid) {
      targetKey = validRsaKeys.find((k) => k.kid === kid)
    } else {
      // Reject ambiguous keys if multiple keys exist without a kid
      if (validRsaKeys.length === 1) {
        targetKey = validRsaKeys[0]
      } else {
        return null
      }
    }

    if (!targetKey) return null

    const keyObj = createPublicKey({ key: targetKey, format: 'jwk' })
    JWKS_CACHE.set(cacheKey, { key: keyObj, expiresAt: Date.now() + JWKS_CACHE_TTL_MS })
    return keyObj
  } catch {
    return null
  }
}

/**
 * Validates a JWT string against server configuration:
 * 1. Strict algorithm check (prevents algorithm confusion)
 * 2. Cryptographic signature check (RS256 or HS256)
 * 3. Claims verification: iss, aud, exp, nbf, iat, sub, mandatory jti
 * Never reads or trusts key URLs from the token header (jku/x5u ignored).
 */
export async function verifySSOToken(token: string): Promise<
  | { valid: true; claims: SSOClaims }
  | {
      valid: false
      code:
        | 'INVALID_TOKEN'
        | 'ALGORITHM_MISMATCH'
        | 'SIGNATURE_INVALID'
        | 'TOKEN_EXPIRED'
        | 'CLAIM_INVALID'
      message: string
    }
> {
  const config = getSSOConfig()
  if (!config) {
    return { valid: false, code: 'INVALID_TOKEN', message: 'ระบบ SSO ยังไม่เปิดใช้งานหรือตั้งค่าไม่สมบูรณ์' }
  }

  if (typeof token !== 'string' || !token) {
    return { valid: false, code: 'INVALID_TOKEN', message: 'ไม่พบ Token' }
  }

  const parts = token.trim().split('.')
  if (parts.length !== 3) {
    return { valid: false, code: 'INVALID_TOKEN', message: 'รูปแบบ JWT ไม่ถูกต้อง' }
  }

  const [headerB64, payloadB64, signatureB64] = parts

  let header: { alg?: string; typ?: string; kid?: string }
  let claims: SSOClaims
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf-8'))
    claims = JSON.parse(base64UrlDecode(payloadB64).toString('utf-8'))
  } catch {
    return { valid: false, code: 'INVALID_TOKEN', message: 'ไม่สามารถอ่านข้อมูลใน Token ได้' }
  }

  // 1. Strict Algorithm Validation (Prevent Algorithm Confusion)
  if (header.alg !== config.algorithm) {
    return {
      valid: false,
      code: 'ALGORITHM_MISMATCH',
      message: `อัลกอริทึมของ Token (${header.alg}) ไม่ตรงกับค่าที่ระบบอนุญาต (${config.algorithm})`,
    }
  }

  // 2. Cryptographic Signature Verification
  const signedContent = Buffer.from(`${headerB64}.${payloadB64}`)
  const signature = base64UrlDecode(signatureB64)

  if (config.algorithm === 'HS256') {
    if (!config.secret) {
      return { valid: false, code: 'SIGNATURE_INVALID', message: 'ไม่พบคีย์สำหรับตรวจสอบ HMAC' }
    }
    const expectedSig = createHmac('sha256', config.secret).update(signedContent).digest()
    if (signature.length !== expectedSig.length || !timingSafeEqual(signature, expectedSig)) {
      return { valid: false, code: 'SIGNATURE_INVALID', message: 'ลายมือชื่อดิจิทัล (Signature) ไม่ถูกต้อง' }
    }
  } else if (config.algorithm === 'RS256') {
    const key = await resolvePublicKey(config, header.kid)
    if (!key) {
      return { valid: false, code: 'SIGNATURE_INVALID', message: 'ไม่สามารถค้นหา Public Key หรือ JWKS เพื่อตรวจสอบได้' }
    }
    const verifier = createVerify('RSA-SHA256')
    verifier.update(signedContent)
    if (!verifier.verify(key, signature)) {
      return { valid: false, code: 'SIGNATURE_INVALID', message: 'ลายมือชื่อดิจิทัล (Signature) ไม่ถูกต้อง' }
    }
  }

  // 3. Claims Verification
  const now = Math.floor(Date.now() / 1000)
  const tol = config.clockToleranceSec

  if (!claims.sub || typeof claims.sub !== 'string' || !claims.sub.trim()) {
    return { valid: false, code: 'CLAIM_INVALID', message: 'ไม่พบข้อมูล subject (sub) ใน Token' }
  }

  if (claims.iss !== config.issuer) {
    return { valid: false, code: 'CLAIM_INVALID', message: 'ผู้รับรอง (iss) ไม่ตรงกับระบบที่กำหนด' }
  }

  const audList = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!audList.includes(config.audience)) {
    return { valid: false, code: 'CLAIM_INVALID', message: 'ผู้รับ (aud) ไม่ตรงกับระบบที่กำหนด' }
  }

  if (typeof claims.exp !== 'number' || now > claims.exp + tol) {
    return { valid: false, code: 'TOKEN_EXPIRED', message: 'Token หมดอายุแล้ว' }
  }

  if (typeof claims.nbf === 'number' && now < claims.nbf - tol) {
    return { valid: false, code: 'CLAIM_INVALID', message: 'Token ยังไม่ถึงเวลาเริ่มต้นใช้งาน (nbf)' }
  }

  if (typeof claims.iat === 'number' && now < claims.iat - tol) {
    return { valid: false, code: 'CLAIM_INVALID', message: 'เวลาที่ออก Token ไม่ถูกต้อง (iat)' }
  }

  // Mandatory jti for Replay Protection
  if (!claims.jti || typeof claims.jti !== 'string' || !claims.jti.trim()) {
    return { valid: false, code: 'CLAIM_INVALID', message: 'Token ต้องมีค่า jti (JWT ID) เพื่อป้องกัน Replay Attack' }
  }

  return { valid: true, claims }
}

/**
 * Atomically records token jti into PostgreSQL to prevent replay attacks across multiple instances.
 * Returns true if the token is newly consumed; false if it was already recorded (replay detected).
 */
export async function consumeReplayToken(issuer: string, jti: string, expiresAt: Date): Promise<boolean> {
  const db = getAuthDatabase()
  try {
    const result = await db.execute<{ jti: string }>(sql`
      insert into private_auth.consumed_tokens (issuer, jti, expires_at)
      values (${issuer}, ${jti}, ${expiresAt.toISOString()})
      on conflict (issuer, jti) do nothing
      returning jti
    `)
    return result.rows.length === 1
  } catch {
    return false
  }
}

/**
 * Periodically or maintenance-driven pruning of expired consumed tokens from PostgreSQL.
 */
export async function pruneExpiredConsumedTokens(): Promise<number> {
  const db = getAuthDatabase()
  try {
    const result = await db.execute(sql`
      delete from private_auth.consumed_tokens
      where expires_at < now()
    `)
    return result.rowCount ?? 0
  } catch {
    return 0
  }
}

/**
 * Maps verified SSO claims to a local profile in public.profiles.
 * Binds strictly by (issuer, subject) in public.user_sso_identities.
 * NEVER auto-links by email alone to prevent account takeover.
 * NEVER alters the user's role or permissions.
 * Strictly verifies is_active = true.
 */
export async function mapSSOClaimsToProfile(claims: SSOClaims): Promise<
  | { success: true; profile: LocalProfile }
  | { success: false; code: 'USER_NOT_MAPPED' | 'ACCOUNT_DEACTIVATED'; message: string }
> {
  const config = getSSOConfig()
  if (!config) {
    return { success: false, code: 'USER_NOT_MAPPED', message: 'ระบบ SSO ยังไม่เปิดใช้งาน' }
  }

  const db = getAuthDatabase()
  const sub = claims.sub.trim()

  // Strict lookup: Only via public.user_sso_identities matching issuer + sub
  const result = await db.execute<LocalProfile>(sql`
    select p.*
    from public.user_sso_identities usi
    join public.profiles p on p.id = usi.user_id
    where usi.issuer = ${config.issuer}
      and usi.subject = ${sub}
    limit 1
  `)

  const profile = result.rows[0]

  if (!profile) {
    return {
      success: false,
      code: 'USER_NOT_MAPPED',
      message: 'บัญชีผู้ใช้นี้ยังไม่ได้ผูกกับระบบพัสดุ กรุณาติดต่อผู้ดูแลระบบเพื่อทำการผูกบัญชี',
    }
  }

  // Strict check: User must be active
  if (!profile.is_active) {
    return {
      success: false,
      code: 'ACCOUNT_DEACTIVATED',
      message: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งานในระบบพัสดุ',
    }
  }

  return { success: true, profile }
}

/**
 * Admin utility to safely bind an existing local user profile to an external SSO identity (issuer + subject).
 * Guarantees no duplicate identities and ensures the target profile exists and is active.
 */
export async function bindUserSSOIdentity(params: {
  userId: string
  issuer: string
  subject: string
  email?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const { userId, issuer, subject, email } = params
  if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return { success: false, error: 'รหัสผู้ใช้ (User ID) ไม่ถูกต้อง' }
  }
  if (!issuer?.trim() || !subject?.trim()) {
    return { success: false, error: 'กรุณาระบุ Issuer และ Subject ให้ครบถ้วน' }
  }

  const db = getAuthDatabase()
  try {
    const profileCheck = await db.execute<{ id: string; is_active: boolean }>(sql`
      select id, is_active from public.profiles where id = ${userId}::uuid limit 1
    `)
    if (!profileCheck.rows.length) {
      return { success: false, error: 'ไม่พบผู้ใช้ในระบบ' }
    }

    const cleanEmail = email?.trim().toLowerCase() || null
    await db.execute(sql`
      insert into public.user_sso_identities (user_id, issuer, subject, email)
      values (${userId}::uuid, ${issuer.trim()}, ${subject.trim()}, ${cleanEmail})
      on conflict (issuer, subject) do update
      set user_id = excluded.user_id, email = excluded.email, updated_at = now()
    `)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการผูกบัญชี SSO'
    return { success: false, error: message }
  }
}

/**
 * Admin utility to unbind an SSO identity from a user account.
 */
export async function unbindUserSSOIdentity(params: {
  userId: string
  issuer: string
  subject: string
}): Promise<{ success: boolean; error?: string }> {
  const { userId, issuer, subject } = params
  const db = getAuthDatabase()
  try {
    const result = await db.execute(sql`
      delete from public.user_sso_identities
      where user_id = ${userId}::uuid and issuer = ${issuer} and subject = ${subject}
    `)
    return { success: (result.rowCount ?? 0) > 0 }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการยกเลิกการผูกบัญชี'
    return { success: false, error: message }
  }
}

/**
 * High-level SSO Login orchestrator:
 * 1. Verifies SSO status
 * 2. Verifies Token (Signature, Algorithm, Claims, Mandatory jti)
 * 3. Maps to Profile strictly by (issuer + sub) in public.user_sso_identities
 * 4. Atomically consumes token in PostgreSQL (prevents multi-instance replay attack)
 * 5. Creates official session in private_auth.sessions
 * 6. Sets standard camms_session cookie
 */
export async function authenticateSSOToken(token: string): Promise<SSOAuthResult> {
  const config = getSSOConfig()
  if (!config) {
    return { success: false, code: 'SSO_DISABLED', message: 'ระบบ SSO ยังไม่เปิดใช้งาน' }
  }

  // 1. Verify token
  const tokenVerification = await verifySSOToken(token)
  if (!tokenVerification.valid) {
    return { success: false, code: tokenVerification.code, message: tokenVerification.message }
  }

  const { claims } = tokenVerification

  // 2. Map claims to profile (Strictly issuer + sub, never auto-link by email)
  const mappingResult = await mapSSOClaimsToProfile(claims)
  if (!mappingResult.success) {
    return { success: false, code: mappingResult.code, message: mappingResult.message }
  }

  // 3. Atomic Replay Protection via PostgreSQL
  const tokenExpiry = new Date((claims.exp + config.clockToleranceSec) * 1000)
  const consumed = await consumeReplayToken(config.issuer, claims.jti, tokenExpiry)
  if (!consumed) {
    return {
      success: false,
      code: 'REPLAY_DETECTED',
      message: 'Token นี้ถูกใช้งานไปแล้ว (Replay Attack Detected)',
    }
  }

  // 4. Issue official CAMMS session
  const session = await createSessionForUserId(mappingResult.profile.id)
  if (!session) {
    return { success: false, code: 'SESSION_ERROR', message: 'ไม่สามารถสร้างเซสชันการเข้าสู่ระบบได้' }
  }

  // 5. Issue standard cookie
  await setSessionCookie(session)
  return { success: true, profile: mappingResult.profile }
}
