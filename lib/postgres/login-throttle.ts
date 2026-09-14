import 'server-only'
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { getAuthDatabase } from './db'

/** Persistent budgets independent of spoofable forwarding headers. */
export async function consumeLoginAttempt(identifier: string): Promise<boolean> {
  const key = createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex')
  return getAuthDatabase().transaction(async tx => {
    await tx.execute(sql`delete from private_auth.login_attempts where window_started_at < now() - interval '1 day'`)
    for (const [bucket,limit] of [['global',200],[key,10]] as const) {
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
