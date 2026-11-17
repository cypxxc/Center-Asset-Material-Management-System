import 'server-only'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { withUserDatabase } from '@/lib/postgres/request'
import { getCurrentProfile } from '@/features/auth/queries'
import type { DisbursementRow } from './types'

export async function getRequestBatch(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null
  const profile = await getCurrentProfile()
  if (!profile?.is_active) return null
  return withUserDatabase(async tx => {
    const result = await tx.execute<{ id: string; created_at: string }>(sql`SELECT id,created_at FROM public.request_batches WHERE id=${id} AND (${profile.role === 'admin'} OR created_by=${profile.id})`)
    if (!result.rows[0]) return null
    const children = await tx.execute<DisbursementRow>(sql`SELECT * FROM public.disbursements WHERE request_batch_id=${id} ORDER BY created_at,id`)
    return { ...result.rows[0], documents: children.rows }
  })
}

export async function recoverRequestBatch(requestKey: string) {
  z.string().uuid().parse(requestKey)
  const profile = await getCurrentProfile()
  if (!profile?.is_active) throw new Error('กรุณาเข้าสู่ระบบ')
  return withUserDatabase(async tx => {
    const result = await tx.execute<{ id: string }>(sql`SELECT id FROM public.request_batches WHERE created_by=${profile.id} AND request_key=${requestKey}`)
    return result.rows[0] ?? null
  })
}
