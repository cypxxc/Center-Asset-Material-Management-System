import { normalizeForStorage } from '@/lib/unicode'

export function parseImportQuantity(raw: string, allowDefault = true): number {
  const value = raw.trim()
  if (!value || value === '-' || value === 'ไม่มี') {
    if (allowDefault) return 1
    throw new Error('กรุณาระบุจำนวนเต็มตั้งแต่ 0 ขึ้นไป')
  }
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value)) throw new Error('จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป')
  const quantity = Number(value.replaceAll(',', ''))
  if (!Number.isSafeInteger(quantity) || quantity > 2147483647) throw new Error('จำนวนเกินขอบเขตที่ระบบรองรับ')
  return quantity
}

export type MaterialImportIdentity = {
  item_type: string; item_name: string; category_name: string | null;
  unit_name: string | null; location_name: string | null; note: string | null;
}

function identity(row: MaterialImportIdentity) {
  let specification = ''
  if (row.note && row.note.trimStart().startsWith('{')) {
    try { specification = String(JSON.parse(row.note).source_fields?.specification ?? '') } catch { /* Ordinary notes have no structured specification. */ }
  }
  return JSON.stringify([row.item_name, row.category_name?.replace(/^\d{4}\s*-\s*/, ''), row.unit_name, row.location_name, specification]
    .map(value => normalizeForStorage(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()))
}

export function createMaterialCategoryResolver(categories: Array<{ name: string; description: string | null }>) {
  const byName = new Map<string, string>()
  const byDescription = new Map<string, string>()
  for (const category of categories) {
    if (!byName.has(category.name)) byName.set(category.name, category.name)
    if (category.description !== null && !byDescription.has(category.description)) {
      byDescription.set(category.description, category.name)
    }
  }
  return (name: string) => {
    const clean = name.replace(/^\d{4}\s*-\s*/, '').trim()
    return byName.get(clean) ?? byName.get(name) ?? byDescription.get(name) ?? clean
  }
}

export function resolvedMaterialCategory(name: string, categories: Array<{ name: string; description: string | null }>) {
  const clean = name.replace(/^\d{4}\s*-\s*/, '').trim()
  return (categories.find(category => category.name === clean)
    ?? categories.find(category => category.name === name)
    ?? categories.find(category => category.description === name))?.name ?? clean
}

export function assertNoDuplicateMaterials(incoming: MaterialImportIdentity[], existing: MaterialImportIdentity[]) {
  const identities = new Set<string>()
  const sourceKeys = new Set<string>()
  const sourceKey = (row: MaterialImportIdentity) => row.note?.match(/\[CAMMS-MATERIAL-\d{4}:[^:\[\]]+:\d+\]/)?.[0]
  for (const row of existing.filter(row => row.item_type === 'material')) {
    identities.add(identity(row))
    const source = sourceKey(row)
    if (source) sourceKeys.add(source)
  }
  for (const [index, row] of incoming.entries()) {
    if (row.item_type !== 'material') continue
    const source = sourceKey(row)
    const key = identity(row)
    if (identities.has(key) || (source && sourceKeys.has(source))) {
      throw new Error(`แถวที่ ${index + 1}: วัสดุ "${row.item_name}" ซ้ำกับรายการในชุดนำเข้าหรือในระบบ กรุณาตรวจสอบก่อนนำเข้า`)
    }
    identities.add(key)
    if (source) sourceKeys.add(source)
  }
}
