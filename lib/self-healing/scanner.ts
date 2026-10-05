import type {
  DiagnosticDependencies,
  DiagnosticIssue,
  DiagnosticItem,
  DiagnosticReport,
} from './types'

async function defaultFetchItems() {
  if (process.env.DATA_BACKEND === 'postgres') {
    try {
      const { getDatabase } = await import('@/lib/postgres/db')
      const { items } = await import('@/db/postgres/schema')
      const { isNull } = await import('drizzle-orm')
      const db = getDatabase()
      return await db
        .select({
          id: items.id,
          item_name: items.item_name,
          asset_no: items.asset_no,
          serial_no: items.serial_no,
          category_id: items.category_id,
          location_id: items.location_id,
          quantity: items.quantity,
        })
        .from(items)
        .where(isNull(items.deleted_at))
    } catch {
      return []
    }
  } else if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createServiceRoleClient } = await import('@/lib/supabase/server')
      const supabase = createServiceRoleClient()
      const { data } = await supabase
        .from('items')
        .select('id, item_name, asset_no, serial_no, category_id, location_id, quantity')
        .is('deleted_at', null)
      return data ?? []
    } catch {
      return []
    }
  }
  return []
}

async function defaultFetchCategoryIds(): Promise<Set<string>> {
  if (process.env.DATA_BACKEND === 'postgres') {
    try {
      const { getDatabase } = await import('@/lib/postgres/db')
      const { categories } = await import('@/db/postgres/schema')
      const db = getDatabase()
      const rows = await db.select({ id: categories.id }).from(categories)
      return new Set(rows.map((r) => r.id))
    } catch {
      return new Set()
    }
  } else if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createServiceRoleClient } = await import('@/lib/supabase/server')
      const supabase = createServiceRoleClient()
      const { data } = await supabase.from('categories').select('id')
      return new Set((data ?? []).map((r: { id: string }) => r.id))
    } catch {
      return new Set()
    }
  }
  return new Set()
}

async function defaultFetchLocationIds(): Promise<Set<string>> {
  if (process.env.DATA_BACKEND === 'postgres') {
    try {
      const { getDatabase } = await import('@/lib/postgres/db')
      const { locations } = await import('@/db/postgres/schema')
      const db = getDatabase()
      const rows = await db.select({ id: locations.id }).from(locations)
      return new Set(rows.map((r) => r.id))
    } catch {
      return new Set()
    }
  } else if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createServiceRoleClient } = await import('@/lib/supabase/server')
      const supabase = createServiceRoleClient()
      const { data } = await supabase.from('locations').select('id')
      return new Set((data ?? []).map((r: { id: string }) => r.id))
    } catch {
      return new Set()
    }
  }
  return new Set()
}

async function defaultGetCachedCount(): Promise<number | null> {
  return null
}

export async function runDiagnostics(
  deps?: DiagnosticDependencies
): Promise<DiagnosticReport> {
  const fetchItems = deps?.fetchItems ?? defaultFetchItems
  const fetchCategoryIds = deps?.fetchCategoryIds ?? defaultFetchCategoryIds
  const fetchLocationIds = deps?.fetchLocationIds ?? defaultFetchLocationIds
  const getCachedCount = deps?.getCachedCount ?? defaultGetCachedCount

  const [items, categoryIds, locationIds, cachedCount] = await Promise.all([
    fetchItems(),
    fetchCategoryIds(),
    fetchLocationIds(),
    getCachedCount(),
  ])

  const issues: DiagnosticIssue[] = []

  // Rule 1: Cache Freshness Check
  if (cachedCount !== null && cachedCount !== undefined && cachedCount !== items.length) {
    issues.push({
      code: 'STALE_CACHE',
      title: 'Stale cache detected',
      severity: 'LOW',
      autoHealable: true,
      details: {
        cachedCount,
        liveCount: items.length,
      },
    })
  }

  // Rule 2: Orphaned Relationship Check
  for (const item of items) {
    const orphanCategory = Boolean(item.category_id && !categoryIds.has(item.category_id))
    const orphanLocation = Boolean(item.location_id && !locationIds.has(item.location_id))

    if (orphanCategory || orphanLocation) {
      issues.push({
        code: 'ORPHAN_RELATION',
        title: `Orphaned relationship on item: ${item.item_name}`,
        severity: 'MEDIUM',
        autoHealable: true,
        details: {
          itemId: item.id,
          itemName: item.item_name,
          categoryId: item.category_id ?? null,
          locationId: item.location_id ?? null,
          orphanCategory,
          orphanLocation,
        },
      })
    }
  }

  // Rule 3: Duplicate Identifier Check
  const assetNoMap = new Map<string, DiagnosticItem[]>()
  const serialNoMap = new Map<string, DiagnosticItem[]>()

  for (const item of items) {
    const assetNo = item.asset_no ? item.asset_no.trim() : ''
    if (assetNo) {
      const existing = assetNoMap.get(assetNo) ?? []
      existing.push(item)
      assetNoMap.set(assetNo, existing)
    }

    const serialNo = item.serial_no ? item.serial_no.trim() : ''
    if (serialNo) {
      const existing = serialNoMap.get(serialNo) ?? []
      existing.push(item)
      serialNoMap.set(serialNo, existing)
    }
  }

  for (const [assetNo, dupItems] of assetNoMap.entries()) {
    if (dupItems.length > 1) {
      issues.push({
        code: 'DUPLICATE_IDENTIFIER',
        title: `Duplicate asset_no: ${assetNo}`,
        severity: 'HIGH',
        autoHealable: false,
        details: {
          type: 'asset_no',
          field: 'asset_no',
          value: assetNo,
          itemIds: dupItems.map((i) => i.id),
          items: dupItems.map((i) => ({ id: i.id, item_name: i.item_name })),
          count: dupItems.length,
        },
      })
    }
  }

  for (const [serialNo, dupItems] of serialNoMap.entries()) {
    if (dupItems.length > 1) {
      issues.push({
        code: 'DUPLICATE_IDENTIFIER',
        title: `Duplicate serial_no: ${serialNo}`,
        severity: 'HIGH',
        autoHealable: false,
        details: {
          type: 'serial_no',
          field: 'serial_no',
          value: serialNo,
          itemIds: dupItems.map((i) => i.id),
          items: dupItems.map((i) => ({ id: i.id, item_name: i.item_name })),
          count: dupItems.length,
        },
      })
    }
  }

  // Rule 4: Inconsistent Stock Check
  for (const item of items) {
    if (typeof item.quantity === 'number' && item.quantity < 0) {
      issues.push({
        code: 'INCONSISTENT_STOCK',
        title: `Inconsistent stock for item: ${item.item_name}`,
        severity: 'MEDIUM',
        autoHealable: false,
        details: {
          itemId: item.id,
          itemName: item.item_name,
          quantity: item.quantity,
        },
      })
    }
  }

  // Health Score Calculation: Start at 100. Deduct 25 for HIGH, 10 for MEDIUM, 5 for LOW. Clamp at 0 minimum.
  let healthScore = 100
  for (const issue of issues) {
    if (issue.severity === 'HIGH') {
      healthScore -= 25
    } else if (issue.severity === 'MEDIUM') {
      healthScore -= 10
    } else if (issue.severity === 'LOW') {
      healthScore -= 5
    }
  }
  healthScore = Math.max(0, healthScore)

  return {
    timestamp: new Date().toISOString(),
    healthScore,
    totalIssues: issues.length,
    issues,
  }
}
