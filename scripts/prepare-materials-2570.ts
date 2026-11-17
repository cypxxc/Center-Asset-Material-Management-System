import ExcelJS from 'exceljs'
import { createHash } from 'node:crypto'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { assertNoDuplicateMaterials } from '../features/items/import-validation'
import { readMaterialLedger, materialLedgerCSV } from '../features/items/material-ledger-importer'

export async function prepareMaterials(sourceDir = 'docs', outputDir = 'docs/material-import-2570') {
  const names = (await readdir(sourceDir)).filter(name => /^[1-4]\. .*2570\.xlsx$/.test(name)).sort()
  if (names.length !== 4) throw new Error('Expected exactly four FY2570 source workbooks')
  const records = []
  const sources = []
  const issues: Array<{ source_key: string; item_name: string; issue: string }> = []
  for (const name of names) {
    const file = resolve(sourceDir, name)
    const bytes = await readFile(file)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(file)
    const prepared = readMaterialLedger(workbook, name)
    records.push(...prepared.records)
    issues.push(...prepared.issues)
    const { count } = prepared
    const valueCents = Math.round(prepared.value * 100)
    sources.push({ file: name, sha256: createHash('sha256').update(bytes).digest('hex'), count, value: valueCents / 100 })
  }
  assertNoDuplicateMaterials(records, [])
  const manifest = { as_of: '2026-10-31', fiscal_year_be: 2570, live_import_ready: false,
    pending: ['ข้อมูลนี้เป็นยอด ณ 31 ต.ค. 2569 ตามไฟล์ต้นฉบับ ไม่ใช่การยืนยันยอดปัจจุบัน'],
    sources, total_items: records.length, zero_balance_items: records.filter(r => r.quantity === 0).length,
    total_value: sources.reduce((sum, s) => sum + Math.round(s.value * 100), 0) / 100, records, issues }
  await mkdir(outputDir, { recursive: true })
  await writeFile(resolve(outputDir, 'materials-2570-snapshot.csv'), materialLedgerCSV(records))
  await writeFile(resolve(outputDir, 'materials-2570-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(JSON.stringify({ total_items: manifest.total_items, zero_balance_items: manifest.zero_balance_items, total_value: manifest.total_value, sources, issues: issues.length }))
  return manifest
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  prepareMaterials(process.argv[2], process.argv[3]).catch(error => { console.error(error.message); process.exitCode = 1 })
}
