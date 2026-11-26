import 'server-only'
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { getAuthDatabase } from './db'

/** Persistent budgets independent of spoofable forwarding headers. */
export async function consumeLoginAttempt(identifier: string): Promise<boolean> {
  const normalized = identifier.normalize('NFC').trim()
  const lowered = normalized.toLowerCase()
  return getAuthDatabase().transaction(async tx => {
    // Resolve matching account ID so email, full_name, and UUID share one per-account budget.
    const condition = normalized.includes('@') ? sql`lower(p.email)=lower(${normalized})`
      : /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(normalized) ? sql`p.id=${normalized}::uuid`
        : sql`lower(p.full_name)=lower(${normalized})`
    const matched = await tx.execute<{ id: string }>(sql`select p.id from public.profiles p where ${condition} order by p.id limit 2`)
    const accountTarget = matched.rows.length === 1 ? `user:${matched.rows[0].id}` : `id:${lowered}`
    const key = createHash('sha256').update(accountTarget).digest('hex')

    // NOTE: Cleanup of old rows is intentionally NOT here — call pruneLoginAttempts()
    // via after() in the login action so it never contends with the login transaction.
    for (const [bucket, limit] of [['global', 1000], [key, 10]] as const) {
      const result = await tx.execute<{ attempts: number }>(sql`
        insert into private_auth.login_attempts(key,attempts) values(${bucket},1)
        on conflict (key) do update set
          attempts=case when login_attempts.window_started_at < now()-interval '1 minute' then 1 else least(login_attempts.attempts+1,${limit+1}) end,
          window_started_at=case when login_attempts.window_started_at < now()-interval '1 minute' then now() else login_attempts.window_started_at end
        returning attempts`)
      if (result.rows[0].attempts > limit) return false
    }
    return true
  })
}

/** Remove expired login-attempt rows. Call via after() so it never blocks the hot path. */
export async function pruneLoginAttempts(): Promise<void> {
  await getAuthDatabase().execute(
    sql`delete from private_auth.login_attempts where window_started_at < now() - interval '1 day'`
  )
}
