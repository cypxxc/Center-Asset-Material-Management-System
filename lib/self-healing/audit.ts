export interface HealingAuditEntry {
  action: 'SYSTEM_SELF_HEAL'
  targetTable: string
  targetId?: string | null
  details: Record<string, unknown>
}

export interface AuditDependencies {
  insertAudit?: (entry: HealingAuditEntry) => Promise<string>
}

export async function recordHealingAudit(
  entry: HealingAuditEntry,
  deps: AuditDependencies = {}
): Promise<string> {
  if (deps.insertAudit) {
    return deps.insertAudit(entry)
  }

  try {
    if (process.env.DATA_BACKEND === 'postgres') {
      const { getDatabase } = await import('@/lib/postgres/db')
      const { auditLogs } = await import('@/db/postgres/schema')
      const [inserted] = await getDatabase()
        .insert(auditLogs)
        .values({
          action: entry.action,
          target_table: entry.targetTable,
          target_id: entry.targetId ?? null,
          new_data: entry.details,
        })
        .returning({ id: auditLogs.id })
      return inserted?.id ?? 'audit-created'
    } else {
      const { createClient } = await import('@supabase/supabase-js')
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      if (!url || !key) return 'audit-skipped-no-key'

      const client = createClient(url, key)
      const { data, error } = await client
        .from('audit_logs')
        .insert({
          action: entry.action,
          target_table: entry.targetTable,
          target_id: entry.targetId ?? null,
          new_data: entry.details,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Failed to write healing audit log:', error)
        return 'audit-failed'
      }
      return data?.id ?? 'audit-created'
    }
  } catch (err) {
    console.error('Error in recordHealingAudit:', err)
    return 'audit-error'
  }
}
