import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { sql } from 'drizzle-orm'
import { getAuthDatabase, type PostgresTransaction } from './db'
import { hashPassword, verifyPassword } from './password'

export const SESSION_COOKIE = 'camms_session'
export type LocalProfile = { id: string; full_name: string; email: string; role: 'admin' | 'staff' | 'viewer'; is_active: boolean; sidebar_order: string[] | null; created_at: string; updated_at: string }
export function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex') }
export async function profileForToken(token: string | undefined): Promise<LocalProfile | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  const result = await getAuthDatabase().execute<LocalProfile>(sql`
    select p.* from private_auth.sessions s join public.profiles p on p.id=s.user_id
    where s.token_hash=${tokenHash(token)} and s.expires_at>now() and p.is_active=true limit 1`)
  return result.rows[0] ?? null
}
export async function getPostgresProfile() { return profileForToken((await cookies()).get(SESSION_COOKIE)?.value) }
async function insertSession(tx: PostgresTransaction, userId: string) {
  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000)
  await tx.execute(sql`insert into private_auth.sessions(token_hash,user_id,expires_at) values (${tokenHash(token)},${userId},${expires.toISOString()})`)
  return { token, expires }
}
export async function setSessionCookie({ token, expires }: { token: string; expires: Date }) {
  ;(await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires })
}
/** Profile then credential locks serialize login with account/password changes. */
export async function authenticatePassword(identifier: string, password: string) {
  if (!identifier || identifier.length > 320 || password.length < 6 || password.length > 1024) return null
  const condition = identifier.includes('@') ? sql`lower(p.email)=lower(${identifier})`
    : /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(identifier) ? sql`p.id=${identifier}::uuid`
      : sql`lower(p.full_name)=lower(${identifier})`
  return getAuthDatabase().transaction(async (tx) => {
    const profiles = await tx.execute<{ id: string; is_active: boolean }>(sql`select p.id,p.is_active from public.profiles p where ${condition} order by p.id limit 2 for update`)
    if (profiles.rows.length !== 1 || !profiles.rows[0].is_active) return null
    const userId = profiles.rows[0].id
    const credentials = await tx.execute<{ password_hash: string }>(sql`select password_hash from private_auth.credentials where user_id=${userId} for update`)
    if (!credentials.rows[0] || !await verifyPassword(password, credentials.rows[0].password_hash)) return null
    return insertSession(tx, userId)
  })
}
export async function replacePasswordForToken(token: string | undefined, password: string) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  const hash = await hashPassword(password)
  return getAuthDatabase().transaction(async (tx) => {
    const profiles = await tx.execute<{ id: string }>(sql`select p.id from public.profiles p join private_auth.sessions s on s.user_id=p.id where s.token_hash=${tokenHash(token)} and p.is_active=true for update of p`)
    const userId = profiles.rows[0]?.id
    if (!userId) return null
    // Recheck after acquiring the profile lock: a concurrent reset may have revoked this cookie.
    const session = await tx.execute(sql`select token_hash from private_auth.sessions where token_hash=${tokenHash(token)} and expires_at>now() for update`)
    if (!session.rows.length) return null
    const result = await tx.execute(sql`update private_auth.credentials set password_hash=${hash} where user_id=${userId} returning user_id`)
    if (!result.rows.length) return null
    await tx.execute(sql`delete from private_auth.sessions where user_id=${userId}`)
    return insertSession(tx, userId)
  })
}
export async function replaceCurrentPassword(password: string) {
  const replacement = await replacePasswordForToken((await cookies()).get(SESSION_COOKIE)?.value, password)
  if (!replacement) return false
  await setSessionCookie(replacement)
  return true
}
export async function deleteSession() {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) await getAuthDatabase().execute(sql`delete from private_auth.sessions where token_hash=${tokenHash(token)}`)
  store.delete(SESSION_COOKIE)
}
