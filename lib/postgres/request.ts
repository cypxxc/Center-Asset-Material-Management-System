import 'server-only'
import { getCurrentProfile } from '@/features/auth/queries'
import { AuthorizationError } from '@/lib/errors'
import { withIdentity, type PostgresTransaction } from './db'
export async function withUserDatabase<T>(callback: (tx: PostgresTransaction) => Promise<T>): Promise<T> {
  const profile = await getCurrentProfile()
  if (!profile?.is_active) throw new AuthorizationError('กรุณาเข้าสู่ระบบ')
  return withIdentity(profile.id, callback)
}
