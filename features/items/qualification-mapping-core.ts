export type Status = 'qualified' | 'below_threshold'
export type SourceRow = { assetNo: string; status: Status | null }
export type DatabaseRow = { id: string; asset_no: string; qualification_status: Status | null }
export type Mapping = {
  id: string
  asset_no: string
  qualification_status: Status
  previousStatus: Status | null
}

function normalize(value: unknown): string {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ')
}

export function getSheetQualificationStatus(sheetName: string, headingTexts: string[]): Status | null {
  const hasBelowHeading = headingTexts.some((text) => text.includes('ต่ำกว่าเกณฑ์'))
  const hasQualifiedHeading = headingTexts.some((text) => text.includes('ตามเกณฑ์'))

  if (hasBelowHeading && hasQualifiedHeading) return null
  if (hasBelowHeading) return 'below_threshold'
  if (hasQualifiedHeading) return 'qualified'
  if (/\(\s*ต\.?\s*\)/u.test(sheetName)) return 'below_threshold'
  return null
}

export function buildQualificationMappings(sourceRows: SourceRow[], databaseRows: DatabaseRow[]) {
  const sourceByAsset = new Map<string, SourceRow[]>()
  for (const row of sourceRows) {
    const key = normalize(row.assetNo)
    sourceByAsset.set(key, [...(sourceByAsset.get(key) ?? []), row])
  }

  const databaseByAsset = new Map<string, DatabaseRow[]>()
  for (const row of databaseRows) {
    const key = normalize(row.asset_no)
    databaseByAsset.set(key, [...(databaseByAsset.get(key) ?? []), row])
  }

  const mappings: Mapping[] = []
  let alreadyApplied = 0
  for (const [assetNo, source] of sourceByAsset) {
    if (source.length !== 1 || source[0].status === null) continue
    const targets = databaseByAsset.get(assetNo) ?? []
    if (targets.length !== 1) continue

    const target = targets[0]
    if (target.qualification_status === source[0].status) {
      alreadyApplied++
      continue
    }

    mappings.push({
      id: target.id,
      asset_no: target.asset_no,
      qualification_status: source[0].status,
      previousStatus: target.qualification_status,
    })
  }

  return {
    mappings,
    alreadyApplied,
    ambiguousSourceIds: [...sourceByAsset.values()].filter((rows) => rows.length > 1).length,
    ambiguousDatabaseIds: [...databaseByAsset.values()].filter((rows) => rows.length > 1).length,
    unmatchedSource: sourceRows.length - mappings.length - alreadyApplied,
    unmatchedDatabase: databaseRows.filter(
      (row) => row.qualification_status === null && !sourceByAsset.has(normalize(row.asset_no)),
    ).length,
  }
}
