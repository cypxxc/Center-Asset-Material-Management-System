import { DiagnosticIssue } from './types'
import { recordHealingAudit, HealingAuditEntry } from './audit'

export interface HealingResult {
  issueCode: string
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED'
  actionTaken: string
  auditId?: string
}

export interface HealerDependencies {
  revalidateCache?: () => Promise<void>
  quarantineOrphanItems?: (orphanItems: Array<{ id: string; name: string }>) => Promise<number>
  recordAudit?: (entry: HealingAuditEntry) => Promise<string>
}

export async function healIssues(
  issues: DiagnosticIssue[],
  deps: HealerDependencies = {}
): Promise<HealingResult[]> {
  const results: HealingResult[] = []

  for (const issue of issues) {
    if (!issue.autoHealable) {
      results.push({
        issueCode: issue.code,
        status: 'SKIPPED',
        actionTaken: 'Issue cannot be healed automatically; flagged for human review',
      })
      continue
    }

    try {
      if (issue.code === 'STALE_CACHE') {
        if (deps.revalidateCache) {
          await deps.revalidateCache()
        } else {
          await defaultRevalidateCache()
        }

        const auditFn = deps.recordAudit ?? recordHealingAudit
        const auditId = await auditFn({
          action: 'SYSTEM_SELF_HEAL',
          targetTable: 'system_cache',
          details: {
            reason: 'STALE_CACHE',
            discrepancy: issue.details.discrepancy,
            cachedCount: issue.details.cachedCount,
            liveCount: issue.details.liveCount,
          },
        })

        results.push({
          issueCode: issue.code,
          status: 'SUCCESS',
          actionTaken: 'Revalidated application cache tags and paths',
          auditId,
        })
      } else if (issue.code === 'ORPHAN_RELATION') {
        const orphanItems = (issue.details.items as Array<{ id: string; name: string }>) || []
        let quarantinedCount = 0

        if (deps.quarantineOrphanItems) {
          quarantinedCount = await deps.quarantineOrphanItems(orphanItems)
        } else {
          quarantinedCount = await defaultQuarantineOrphans(orphanItems)
        }

        const auditFn = deps.recordAudit ?? recordHealingAudit
        const auditId = await auditFn({
          action: 'SYSTEM_SELF_HEAL',
          targetTable: 'items',
          details: {
            reason: 'ORPHAN_RELATION',
            quarantinedCount,
            itemIds: orphanItems.map((i) => i.id),
          },
        })

        results.push({
          issueCode: issue.code,
          status: 'SUCCESS',
          actionTaken: `Quarantined ${quarantinedCount} orphaned items to safe category`,
          auditId,
        })
      } else {
        results.push({
          issueCode: issue.code,
          status: 'SKIPPED',
          actionTaken: `No automated healing recipe available for ${issue.code}`,
        })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({
        issueCode: issue.code,
        status: 'FAILED',
        actionTaken: `Healing failed: ${message}`,
      })
    }
  }

  return results
}

async function defaultRevalidateCache(): Promise<void> {
  try {
    const { revalidateTag, revalidatePath } = await import('next/cache')
    revalidateTag('items', 'max')
    revalidateTag('sidebar-data', 'max')
    revalidateTag('item-references', 'max')
    revalidatePath('/', 'layout')
  } catch {
    // Graceful fallback when outside Next.js request context (e.g. CLI/tests)
  }
}

async function defaultQuarantineOrphans(
  orphanItems: Array<{ id: string; name: string }>
): Promise<number> {
  if (orphanItems.length === 0) return 0

  const QUARANTINE_CAT_NAME = '[รอตรวจสอบ - Auto Quarantined]'

  if (process.env.DATA_BACKEND === 'postgres') {
    const { getDatabase } = await import('@/lib/postgres/db')
    const { categories, items } = await import('@/db/postgres/schema')
    const { eq, inArray, sql } = await import('drizzle-orm')
    const db = getDatabase()

    let [cat] = await db.select().from(categories).where(eq(categories.name, QUARANTINE_CAT_NAME)).limit(1)
    if (!cat) {
      ;[cat] = await db
        .insert(categories)
        .values({
          name: QUARANTINE_CAT_NAME,
          description: 'หมวดหมู่พักรายการครุภัณฑ์ที่พบความผิดปกติของความสัมพันธ์เพื่อรอเจ้าหน้าที่ตรวจสอบ',
        })
        .returning()
    }

    if (!cat) return 0

    const ids = orphanItems.map((i) => i.id)
    await db
      .update(items)
      .set({
        category_id: cat.id,
        note: sql`concat(coalesce(${items.note}, ''), ' [Quarantined by Self-Healing on ', now()::text, ']')`,
      })
      .where(inArray(items.id, ids))

    return ids.length
  } else {
    const { createClient } = await import('@supabase/supabase-js')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!url || !key) return 0

    const client = createClient(url, key)
    let { data: cat } = await client.from('categories').select('id').eq('name', QUARANTINE_CAT_NAME).single()
    if (!cat) {
      const { data: created } = await client
        .from('categories')
        .insert({
          name: QUARANTINE_CAT_NAME,
          description: 'หมวดหมู่พักรายการครุภัณฑ์ที่พบความผิดปกติของความสัมพันธ์เพื่อรอเจ้าหน้าที่ตรวจสอบ',
        })
        .select('id')
        .single()
      cat = created
    }

    if (!cat) return 0

    const ids = orphanItems.map((i) => i.id)
    for (const id of ids) {
      await client
        .from('items')
        .update({
          category_id: cat.id,
        })
        .eq('id', id)
    }

    return ids.length
  }
}
