# Audit Log Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make audit log JSON and item history diffs readable in Thai, with a DB Panel detail modal and a collapsible item timeline.

**Architecture:** Add a React-free audit display helper with tested translation, value formatting, and diff generation. Use that helper in the DB Panel client table/modal and in a new small client component for the item detail timeline while keeping page data fetching server-side.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, Node `node:test`, Tailwind v4 classes, `lucide-react`.

---

## File Structure

- Create `features/audit-log-display/format.ts`: pure TypeScript helper for action labels, table labels, field labels, value formatting, raw JSON formatting, and diff generation.
- Create `features/audit-log-display/format.test.ts`: Node tests for all helper behavior.
- Modify `app/(dashboard)/admin/db-panel/db-panel-client.tsx`: render translated audit cells, add selected audit row state, and add the audit detail modal.
- Create `app/(dashboard)/items/[id]/item-audit-timeline.tsx`: client component for the admin-only collapsible item history timeline.
- Modify `app/(dashboard)/items/[id]/page.tsx`: replace inline audit timeline JSX with the new client component.

## Task 0: Read Required Next.js 16 Docs

**Files:**
- Read: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`
- Read: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`

- [ ] **Step 1: Read the `use client` directive guide**

Run:

```powershell
Get-Content -Raw node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md
```

Expected: the guide explains that client components need the `'use client'` directive and their props must be serializable.

- [ ] **Step 2: Read the server/client component guide**

Run:

```powershell
Get-Content -Raw node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
```

Expected: the guide explains composing client components under server components.

- [ ] **Step 3: Commit**

No commit for reading-only work.

## Task 1: Audit Display Helper Tests

**Files:**
- Create: `features/audit-log-display/format.test.ts`
- Later modify: `features/audit-log-display/format.ts`

- [ ] **Step 1: Write the failing tests**

Create `features/audit-log-display/format.test.ts` with:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAuditDiff,
  formatAuditValue,
  formatJsonForDisplay,
  getAuditActionLabel,
  getAuditFieldLabel,
  getAuditTableLabel,
  summarizeAuditPayload,
} from './format'

test('translates audit action labels with fallback to raw action', () => {
  assert.equal(getAuditActionLabel('create'), 'สร้างข้อมูล')
  assert.equal(getAuditActionLabel('update'), 'แก้ไขข้อมูล')
  assert.equal(getAuditActionLabel('delete'), 'ลบข้อมูล')
  assert.equal(getAuditActionLabel('restore'), 'กู้คืนข้อมูล')
  assert.equal(getAuditActionLabel('hard_delete'), 'ลบถาวร')
  assert.equal(getAuditActionLabel('sql_query'), 'เรียกใช้ SQL')
  assert.equal(getAuditActionLabel('unknown_action'), 'unknown_action')
})

test('translates audit target table labels with fallback to raw table name', () => {
  assert.equal(getAuditTableLabel('items'), 'รายการพัสดุ')
  assert.equal(getAuditTableLabel('profiles'), 'บัญชีผู้ใช้')
  assert.equal(getAuditTableLabel('categories'), 'หมวดหมู่')
  assert.equal(getAuditTableLabel('locations'), 'สถานที่')
  assert.equal(getAuditTableLabel('units'), 'หน่วยนับ')
  assert.equal(getAuditTableLabel('audit_logs'), 'ประวัติการทำรายการ')
  assert.equal(getAuditTableLabel('custom_table'), 'custom_table')
})

test('translates audit field labels with fallback to raw field name', () => {
  assert.equal(getAuditFieldLabel('item_name'), 'ชื่อพัสดุครุภัณฑ์')
  assert.equal(getAuditFieldLabel('unit_price'), 'ราคาต่อหน่วย')
  assert.equal(getAuditFieldLabel('target_table'), 'ตารางเป้าหมาย')
  assert.equal(getAuditFieldLabel('unknown_field'), 'unknown_field')
})

test('formats known audit values for Thai display', () => {
  assert.equal(formatAuditValue('status', 'waiting_repair'), 'รอซ่อม')
  assert.equal(formatAuditValue('item_type', 'asset'), 'ครุภัณฑ์')
  assert.equal(formatAuditValue('role', 'staff'), 'เจ้าหน้าที่')
  assert.equal(formatAuditValue('is_active', true), 'เปิดใช้งาน')
  assert.equal(formatAuditValue('deleted_at', null), 'ไม่มีข้อมูล')
  assert.equal(formatAuditValue('quantity', 12), '12')
  assert.equal(formatAuditValue('new_data', { query: 'select 1' }), '{ "query": "select 1" }')
})

test('buildAuditDiff returns only changed fields and ignores updated_at by default', () => {
  const diff = buildAuditDiff(
    {
      item_name: 'โต๊ะทำงาน',
      status: 'active',
      quantity: 1,
      updated_at: '2026-07-01T00:00:00.000Z',
    },
    {
      item_name: 'โต๊ะทำงาน',
      status: 'waiting_repair',
      quantity: 3,
      updated_at: '2026-07-02T00:00:00.000Z',
    },
  )

  assert.deepEqual(diff, [
    {
      key: 'status',
      label: 'สถานะพัสดุ',
      oldValue: 'ใช้งานอยู่',
      newValue: 'รอซ่อม',
    },
    {
      key: 'quantity',
      label: 'จำนวน',
      oldValue: '1',
      newValue: '3',
    },
  ])
})

test('buildAuditDiff handles create-style payloads with only new data', () => {
  const diff = buildAuditDiff(null, {
    item_name: 'เครื่องพิมพ์',
    item_type: 'asset',
  })

  assert.deepEqual(diff, [
    {
      key: 'item_name',
      label: 'ชื่อพัสดุครุภัณฑ์',
      oldValue: 'ไม่มีข้อมูล',
      newValue: 'เครื่องพิมพ์',
    },
    {
      key: 'item_type',
      label: 'ประเภทสิ่งของ',
      oldValue: 'ไม่มีข้อมูล',
      newValue: 'ครุภัณฑ์',
    },
  ])
})

test('summarizeAuditPayload returns changed field count or raw JSON fallback text', () => {
  assert.equal(
    summarizeAuditPayload({ status: 'active' }, { status: 'waiting_repair' }),
    'เปลี่ยนแปลง 1 ฟิลด์',
  )
  assert.equal(summarizeAuditPayload({ status: 'active' }, { status: 'active' }), 'ดูรายละเอียด JSON')
  assert.equal(summarizeAuditPayload(null, { query: 'select 1' }), 'เปลี่ยนแปลง 1 ฟิลด์')
})

test('formatJsonForDisplay produces stable pretty JSON and handles null', () => {
  assert.equal(formatJsonForDisplay({ status: 'active' }), '{\n  "status": "active"\n}')
  assert.equal(formatJsonForDisplay(null), 'null')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- features/audit-log-display/format.test.ts
```

Expected: FAIL because `features/audit-log-display/format.ts` does not exist.

- [ ] **Step 3: Commit**

No commit yet; this is the red stage for Task 2.

## Task 2: Audit Display Helper Implementation

**Files:**
- Create: `features/audit-log-display/format.ts`
- Test: `features/audit-log-display/format.test.ts`

- [ ] **Step 1: Create the minimal helper implementation**

Create `features/audit-log-display/format.ts` with:

```ts
export interface AuditDiffEntry {
  key: string
  label: string
  oldValue: string
  newValue: string
}

const ACTION_LABELS: Record<string, string> = {
  create: 'สร้างข้อมูล',
  update: 'แก้ไขข้อมูล',
  delete: 'ลบข้อมูล',
  restore: 'กู้คืนข้อมูล',
  hard_delete: 'ลบถาวร',
  bulk_delete: 'ลบหลายรายการ',
  sql_query: 'เรียกใช้ SQL',
  backup_restore: 'กู้คืนฐานข้อมูล',
  create_user: 'สร้างผู้ใช้',
  update_user: 'แก้ไขผู้ใช้',
  delete_user: 'ลบผู้ใช้',
  reset_password: 'รีเซ็ตรหัสผ่าน',
}

const TABLE_LABELS: Record<string, string> = {
  items: 'รายการพัสดุ',
  profiles: 'บัญชีผู้ใช้',
  categories: 'หมวดหมู่',
  locations: 'สถานที่',
  units: 'หน่วยนับ',
  audit_logs: 'ประวัติการทำรายการ',
}

const FIELD_LABELS: Record<string, string> = {
  id: 'รหัสแถว',
  user_id: 'ผู้ใช้ที่ทำรายการ',
  action: 'ประเภทการทำรายการ',
  target_table: 'ตารางเป้าหมาย',
  target_id: 'รหัสแถวเป้าหมาย',
  old_data: 'ข้อมูลเดิม',
  new_data: 'ข้อมูลใหม่',
  created_at: 'วันที่สร้าง',
  updated_at: 'วันที่อัปเดต',
  deleted_at: 'วันที่ลบ',
  item_name: 'ชื่อพัสดุครุภัณฑ์',
  item_type: 'ประเภทสิ่งของ',
  category_id: 'หมวดหมู่',
  unit_id: 'หน่วยนับ',
  location_id: 'สถานที่',
  asset_no: 'เลขครุภัณฑ์',
  serial_no: 'Serial Number',
  brand: 'ยี่ห้อ/แบรนด์',
  model: 'รุ่นสินค้า',
  quantity: 'จำนวน',
  unit_price: 'ราคาต่อหน่วย',
  status: 'สถานะพัสดุ',
  responsible_person: 'ผู้รับผิดชอบ',
  note: 'หมายเหตุ',
  image_url: 'รูปภาพ',
  full_name: 'ชื่อ-นามสกุล',
  email: 'บัญชี / อีเมล',
  role: 'บทบาท',
  is_active: 'สถานะเปิดใช้งาน',
  name: 'ชื่อ',
  description: 'คำอธิบาย',
  building: 'อาคาร',
  floor: 'ชั้น',
  room: 'ห้อง',
  department: 'แผนก/หน่วยงาน',
  query: 'คำสั่ง SQL',
  tables_restored: 'ตารางที่กู้คืน',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'ใช้งานอยู่',
  spare: 'สำรอง',
  damaged: 'ชำรุด',
  waiting_repair: 'รอซ่อม',
  inactive: 'ไม่ใช้งาน',
  disposed: 'จำหน่ายแล้ว',
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'ครุภัณฑ์',
  material: 'วัสดุสิ้นเปลือง',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  staff: 'เจ้าหน้าที่',
  viewer: 'ผู้เข้าชม',
}

const IGNORED_DIFF_KEYS = new Set(['updated_at'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stableValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (isRecord(value) || Array.isArray(value)) return JSON.stringify(value)
  return String(value)
}

export function getAuditActionLabel(action: string | null | undefined): string {
  if (!action) return 'ไม่ระบุ'
  return ACTION_LABELS[action] ?? action
}

export function getAuditTableLabel(tableName: string | null | undefined): string {
  if (!tableName) return 'ไม่ระบุ'
  return TABLE_LABELS[tableName] ?? tableName
}

export function getAuditFieldLabel(fieldName: string): string {
  return FIELD_LABELS[fieldName] ?? fieldName
}

export function formatAuditValue(fieldName: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'ไม่มีข้อมูล'
  if (typeof value === 'boolean') return value ? 'เปิดใช้งาน' : 'ปิดใช้งาน'
  if (fieldName === 'status' && typeof value === 'string') return STATUS_LABELS[value] ?? value
  if (fieldName === 'item_type' && typeof value === 'string') return TYPE_LABELS[value] ?? value
  if (fieldName === 'role' && typeof value === 'string') return ROLE_LABELS[value] ?? value
  if (Array.isArray(value)) return value.map((item) => formatAuditValue(fieldName, item)).join(', ')
  if (isRecord(value)) return JSON.stringify(value).replaceAll('":"', '": "').replaceAll('","', '", "')
  return String(value)
}

export function buildAuditDiff(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined,
): AuditDiffEntry[] {
  const oldRecord = isRecord(oldData) ? oldData : {}
  const newRecord = isRecord(newData) ? newData : {}
  const keys = Array.from(new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]))

  return keys
    .filter((key) => !IGNORED_DIFF_KEYS.has(key))
    .filter((key) => stableValue(oldRecord[key]) !== stableValue(newRecord[key]))
    .map((key) => ({
      key,
      label: getAuditFieldLabel(key),
      oldValue: formatAuditValue(key, oldRecord[key]),
      newValue: formatAuditValue(key, newRecord[key]),
    }))
}

export function summarizeAuditPayload(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined,
): string {
  const count = buildAuditDiff(oldData, newData).length
  return count > 0 ? `เปลี่ยนแปลง ${count} ฟิลด์` : 'ดูรายละเอียด JSON'
}

export function formatJsonForDisplay(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2)
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run:

```powershell
npm test -- features/audit-log-display/format.test.ts
```

Expected: PASS for all tests in `format.test.ts`.

- [ ] **Step 3: Commit**

Run:

```powershell
git add features/audit-log-display/format.ts features/audit-log-display/format.test.ts
git commit -m "Add audit log display formatter"
```

Expected: commit succeeds with only the helper and helper tests staged.

## Task 3: DB Panel Audit Modal

**Files:**
- Modify: `app/(dashboard)/admin/db-panel/db-panel-client.tsx`
- Use: `features/audit-log-display/format.ts`

- [ ] **Step 1: Add imports and selected row state**

Modify the import block in `app/(dashboard)/admin/db-panel/db-panel-client.tsx` to include `Eye`:

```ts
  RefreshCw,
  Eye,
  X
```

Add this import after existing local imports:

```ts
import {
  buildAuditDiff,
  formatJsonForDisplay,
  getAuditActionLabel,
  getAuditTableLabel,
  summarizeAuditPayload,
} from '@/features/audit-log-display/format'
```

Add state after form state:

```ts
  const [selectedAuditRow, setSelectedAuditRow] = useState<Record<string, unknown> | null>(null)
```

- [ ] **Step 2: Add local audit row helpers before `export default function DBPanelClient()`**

Add:

```ts
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function formatCellValue(row: Record<string, unknown>, colName: string, selectedTable: string, activeTab: TabId) {
  const rawVal = row[colName]

  if (activeTab === 'audit') {
    if (colName === 'action') return getAuditActionLabel(typeof rawVal === 'string' ? rawVal : null)
    if (colName === 'target_table') return getAuditTableLabel(typeof rawVal === 'string' ? rawVal : null)
    if (colName === 'old_data' || colName === 'new_data') {
      return summarizeAuditPayload(asRecord(row.old_data), asRecord(row.new_data))
    }
  }

  if (rawVal === null || rawVal === undefined) return '-'
  if (typeof rawVal === 'boolean') return rawVal ? 'TRUE' : 'FALSE'
  if (typeof rawVal === 'object') return JSON.stringify(rawVal)
  if (selectedTable === 'profiles' && colName === 'email' && typeof rawVal === 'string') {
    return formatDisplayEmail(rawVal)
  }
  return String(rawVal)
}
```

- [ ] **Step 3: Replace the table cell value calculation**

Inside the `activeSchema.map(col => {` callback in the table body, replace the existing `rawVal` to `valStr` block with:

```ts
                          const rawVal = row[col.name]
                          const valStr = formatCellValue(row, col.name, selectedTable, activeTab)
                          const isAuditJsonCell = activeTab === 'audit' && (col.name === 'old_data' || col.name === 'new_data')
```

Then replace the `<td>` body with:

```tsx
                              {isAuditJsonCell ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedAuditRow(row)}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-blue-900/50 bg-blue-950/30 px-2 py-1 text-[10px] font-bold text-blue-200 hover:border-blue-700 hover:bg-blue-900/50"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>{valStr}</span>
                                </button>
                              ) : activeTab === 'audit' && col.name === 'action' ? (
                                <div>
                                  <div className="font-bold text-slate-100">{valStr}</div>
                                  <div className="text-[9px] text-slate-500">{String(rawVal ?? '-')}</div>
                                </div>
                              ) : activeTab === 'audit' && col.name === 'target_table' ? (
                                <div>
                                  <div className="font-bold text-slate-100">{valStr}</div>
                                  <div className="text-[9px] text-slate-500">{String(rawVal ?? '-')}</div>
                                </div>
                              ) : (
                                valStr
                              )}
```

- [ ] **Step 4: Add the audit detail modal before the existing form modal**

Add this block immediately before `{/* MODAL FORM: Add / Edit Row */}`:

```tsx
      {selectedAuditRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-slate-200 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 p-5">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-white">
                  รายละเอียดประวัติการทำรายการ
                </h3>
                <p className="text-[11px] text-slate-400">
                  {getAuditActionLabel(String(selectedAuditRow.action ?? ''))}
                  {' · '}
                  {getAuditTableLabel(String(selectedAuditRow.target_table ?? ''))}
                  {' · '}
                  {String(selectedAuditRow.target_id ?? 'ไม่ระบุแถว')}
                </p>
                <p className="text-[10px] text-slate-500">
                  {selectedAuditRow.created_at ? new Date(String(selectedAuditRow.created_at)).toLocaleString('th-TH') : 'ไม่ระบุเวลา'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditRow(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="ปิดรายละเอียดประวัติ"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(88vh-96px)] overflow-y-auto p-5 space-y-4">
              {(() => {
                const oldData = asRecord(selectedAuditRow.old_data)
                const newData = asRecord(selectedAuditRow.new_data)
                const diff = buildAuditDiff(oldData, newData)

                return (
                  <>
                    <section className="rounded-lg border border-slate-800 bg-slate-950/50">
                      <div className="border-b border-slate-800 px-4 py-3">
                        <h4 className="text-xs font-bold text-slate-100">รายการเปลี่ยนแปลง</h4>
                      </div>
                      {diff.length > 0 ? (
                        <div className="divide-y divide-slate-800">
                          {diff.map((entry) => (
                            <div key={entry.key} className="grid gap-3 p-4 md:grid-cols-[180px_1fr_1fr]">
                              <div>
                                <div className="text-xs font-bold text-slate-100">{entry.label}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{entry.key}</div>
                              </div>
                              <div className="rounded-lg border border-red-950/60 bg-red-950/20 p-3">
                                <div className="mb-1 text-[10px] font-bold text-red-300">ค่าเดิม</div>
                                <div className="break-words text-xs text-slate-200">{entry.oldValue}</div>
                              </div>
                              <div className="rounded-lg border border-blue-950/60 bg-blue-950/20 p-3">
                                <div className="mb-1 text-[10px] font-bold text-blue-300">ค่าใหม่</div>
                                <div className="break-words text-xs text-slate-200">{entry.newValue}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-xs text-slate-400">
                          ไม่พบฟิลด์ที่เปลี่ยนแปลง หรือรายการนี้เป็นข้อมูลเหตุการณ์แบบ JSON ดิบ
                        </div>
                      )}
                    </section>

                    <details className="rounded-lg border border-slate-800 bg-slate-950/40">
                      <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-slate-200">
                        ดู JSON ต้นฉบับ
                      </summary>
                      <div className="grid gap-3 border-t border-slate-800 p-4 md:grid-cols-2">
                        <div>
                          <div className="mb-2 text-[10px] font-bold text-slate-500">old_data</div>
                          <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300">{formatJsonForDisplay(selectedAuditRow.old_data)}</pre>
                        </div>
                        <div>
                          <div className="mb-2 text-[10px] font-bold text-slate-500">new_data</div>
                          <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-[10px] text-slate-300">{formatJsonForDisplay(selectedAuditRow.new_data)}</pre>
                        </div>
                      </div>
                    </details>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Run lint for edited file**

Run:

```powershell
npm run lint -- app/(dashboard)/admin/db-panel/db-panel-client.tsx
```

Expected: PASS, or if the script does not accept a file argument, run `npm run lint` and confirm no new lint errors point to `db-panel-client.tsx`.

- [ ] **Step 6: Commit**

Run:

```powershell
git add app/(dashboard)/admin/db-panel/db-panel-client.tsx
git commit -m "Improve audit log details in DB panel"
```

Expected: commit succeeds with only the DB Panel change staged.

## Task 4: Item Audit Timeline Client Component

**Files:**
- Create: `app/(dashboard)/items/[id]/item-audit-timeline.tsx`
- Modify: `app/(dashboard)/items/[id]/page.tsx`
- Use: `features/audit-log-display/format.ts`

- [ ] **Step 1: Create the client component**

Create `app/(dashboard)/items/[id]/item-audit-timeline.tsx` with:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, History } from 'lucide-react'
import {
  buildAuditDiff,
  getAuditActionLabel,
} from '@/features/audit-log-display/format'
import type { ItemAuditLog } from '@/features/items/queries'

interface ItemAuditTimelineProps {
  logs: ItemAuditLog[]
}

const COLLAPSED_COUNT = 3

export function ItemAuditTimeline({ logs }: ItemAuditTimelineProps) {
  const [expanded, setExpanded] = useState(false)
  const visibleLogs = useMemo(
    () => expanded ? logs : logs.slice(0, COLLAPSED_COUNT),
    [expanded, logs],
  )
  const hiddenCount = Math.max(0, logs.length - COLLAPSED_COUNT)

  if (logs.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
        ประวัติการทำรายการและตรวจนับ (Audit Logs)
      </h3>
      <div className="flow-root">
        <ul className="-mb-8">
          {visibleLogs.map((log, logIdx) => {
            const diff = buildAuditDiff(log.old_data, log.new_data)
            const isLastVisible = logIdx === visibleLogs.length - 1

            return (
              <li key={log.id}>
                <div className="relative pb-8">
                  {!isLastVisible ? (
                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                  ) : null}
                  <div className="relative flex space-x-3">
                    <div>
                      <span className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center ring-8 ring-white">
                        <History className="h-4 w-4 text-blue-600" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 pt-1.5 flex justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-800 font-bold">
                          {getAuditActionLabel(log.action)}{' '}
                          <span className="font-semibold text-slate-500">โดย {log.user_name}</span>
                        </p>
                        {diff.length > 0 ? (
                          <div className="mt-2 text-[11px] bg-slate-50 border border-slate-100 p-2 rounded-lg text-slate-600 max-h-32 overflow-y-auto space-y-1">
                            {diff.map((entry) => (
                              <div key={entry.key} className="leading-5">
                                <span className="font-bold text-slate-700">{entry.label}</span>
                                <span>: {entry.oldValue} → </span>
                                <span className="font-bold text-blue-600">{entry.newValue}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-[11px] text-slate-400">
                            ไม่มีรายละเอียดฟิลด์ที่เปลี่ยนแปลง
                          </div>
                        )}
                      </div>
                      <div className="text-right text-[10px] whitespace-nowrap text-slate-400 font-semibold">
                        {new Date(log.created_at).toLocaleString('th-TH')}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span>{expanded ? 'ย่อรายการประวัติ' : `แสดงประวัติทั้งหมดอีก ${hiddenCount} รายการ`}</span>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Replace inline timeline in the page**

In `app/(dashboard)/items/[id]/page.tsx`, add:

```ts
import { ItemAuditTimeline } from './item-audit-timeline'
```

Remove this import because the page no longer renders the inline history icon:

```ts
import { ArrowLeft, Edit } from 'lucide-react'
```

Replace it with:

```ts
import { ArrowLeft, Edit } from 'lucide-react'
```

The import remains the same in this codebase because `History` was not imported before; no icon import removal is required.

Remove the existing JSX block that starts with this comment:

```tsx
        {/* Audit Log Timeline (Admin Only) */}
```

and ends immediately before the final two closing `</div>` elements of the page. Insert this replacement in the same location:

```tsx
        {profile?.role === 'admin' && <ItemAuditTimeline logs={auditLogs} />}
```

- [ ] **Step 3: Run lint for edited files**

Run:

```powershell
npm run lint -- app/(dashboard)/items/[id]/page.tsx app/(dashboard)/items/[id]/item-audit-timeline.tsx
```

Expected: PASS, or if the script does not accept file arguments, run `npm run lint` and confirm no new lint errors point to these files.

- [ ] **Step 4: Commit**

Run:

```powershell
git add app/(dashboard)/items/[id]/page.tsx app/(dashboard)/items/[id]/item-audit-timeline.tsx
git commit -m "Add collapsible Thai audit timeline"
```

Expected: commit succeeds with only item timeline files staged.

## Task 5: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run unit tests**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```powershell
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 4: Check git status**

Run:

```powershell
git status --short
```

Expected: only pre-existing unrelated files remain unstaged, such as `scripts/mcp-server.ts`, `app/api/revalidate/`, and `scripts/seed-100-items.ts`, unless the user changed the worktree during execution.

- [ ] **Step 5: Final commit only if verification required fixes**

If Task 5 required code fixes, stage the known implementation files and commit the verification fixes:

```powershell
git add features/audit-log-display/format.ts features/audit-log-display/format.test.ts app/(dashboard)/admin/db-panel/db-panel-client.tsx app/(dashboard)/items/[id]/page.tsx app/(dashboard)/items/[id]/item-audit-timeline.tsx
git commit -m "Fix audit log display verification issues"
```

Expected: no commit is needed if Task 1 through Task 4 commits already pass all verification.

## Self-Review

- Spec coverage: helper translations, DB Panel modal, raw JSON access, Thai action/table/field labels, and collapsible 3-item timeline are all covered.
- Placeholder scan: no `TBD`, `TODO`, or incomplete behavior is left in this plan.
- Type consistency: `ItemAuditLog` comes from `features/items/queries`, helper functions are imported from `features/audit-log-display/format`, and client-only timeline state stays in `item-audit-timeline.tsx`.
