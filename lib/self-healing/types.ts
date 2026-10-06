export type DiagnosticSeverity = 'LOW' | 'MEDIUM' | 'HIGH'

export interface DiagnosticIssue {
  code: string
  title: string
  severity: DiagnosticSeverity
  autoHealable: boolean
  details: Record<string, unknown>
}

export interface DiagnosticReport {
  timestamp: string
  healthScore: number
  totalIssues: number
  issues: DiagnosticIssue[]
}

export interface DiagnosticItem {
  id: string
  item_name: string
  asset_no?: string | null
  serial_no?: string | null
  category_id?: string | null
  location_id?: string | null
  quantity: number
}

export interface DiagnosticDependencies {
  fetchItems?: () => Promise<DiagnosticItem[]>
  fetchCategoryIds?: () => Promise<Set<string>>
  fetchLocationIds?: () => Promise<Set<string>>
  getCachedCount?: () => Promise<number | null>
}
