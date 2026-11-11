export interface HealingAuditEntry { action: 'SYSTEM_SELF_HEAL'; targetTable: string; targetId?: string | null; details: Record<string, unknown> }
export interface AuditDependencies { insertAudit?: (entry: HealingAuditEntry) => Promise<string> }

export async function recordHealingAudit(entry: HealingAuditEntry, deps: AuditDependencies = {}): Promise<string> {
  if (deps.insertAudit) return deps.insertAudit(entry)
  try {
    const { getDatabase } = await import('@/lib/postgres/db')
    const { auditLogs } = await import('@/db/postgres/schema')
    const [inserted] = await getDatabase().insert(auditLogs).values({
      action: entry.action, target_table: entry.targetTable, target_id: entry.targetId ?? null, new_data: entry.details,
    }).returning({ id: auditLogs.id })
    return inserted?.id ?? 'audit-created'
  } catch (error) {
    console.error('Error in recordHealingAudit:', error)
    return 'audit-error'
  }
}
