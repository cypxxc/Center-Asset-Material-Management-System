import 'server-only'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { getCurrentProfile } from '@/features/auth/queries'
import { withUserDatabase } from '@/lib/postgres/request'
import { handoverDecision } from './tracking'

type HandoverRow = {
  id: string
  transaction_type: string
  status: string
  handed_over_at: string | null
  handed_over_by: string | null
}

/** Records the physical event only. Approval/submission own all inventory movements. */
export async function markPostgresDisbursementHandover(rawId: unknown) {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || profile.role !== 'admin') throw new Error('เฉพาะผู้ดูแลระบบเท่านั้นที่บันทึกส่งมอบจริงได้')
  const id = z.uuid().parse(rawId)
  return withUserDatabase(async tx => {
    // Serialize with approval, cancellation, return and other handover attempts.
    const result = await tx.execute<HandoverRow>(sql`select id, transaction_type, status, handed_over_at, handed_over_by
      from public.disbursements where id=${id} for update`)
    const doc = result.rows[0]
    if (!doc) throw new Error('ไม่พบเอกสารเบิกจ่าย')
    if (handoverDecision(doc) === 'existing') return { id: doc.id, handed_over_at: doc.handed_over_at!, handed_over_by: doc.handed_over_by }
    const updated = await tx.execute<{ id: string; handed_over_at: string; handed_over_by: string | null }>(sql`update public.disbursements
      set handed_over_at=now(), handed_over_by=${profile.id}, updated_at=now() where id=${id}
      returning id, handed_over_at, handed_over_by`)
    const event = updated.rows[0]
    await tx.execute(sql`insert into public.audit_logs (user_id, action, target_table, target_id, old_data, new_data)
      values (${profile.id}, 'RECORD_ACTUAL_HANDOVER', 'disbursements', ${id},
        ${JSON.stringify({ handed_over_at: null, handed_over_by: null })}::jsonb, ${JSON.stringify(event)}::jsonb)`)
    return event
  })
}
