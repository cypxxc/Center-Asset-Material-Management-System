import { createHash } from 'node:crypto'
import type { ItemStatus, ItemType } from './types'
import { itemStatuses, itemTypes, type NormalizedItemListSearchParams } from './list-params'
export { BATCH_SIZE, normalizeItemListSearchParams, type NormalizedItemListSearchParams, type ItemSortColumn, type ItemSortDirection } from './list-params'
export type ItemCursorKey = string | number

interface EncodedItemCursor {
  v: 1
  filters: string
  key: ItemCursorKey
  id: string
}

export class CursorError extends Error {
  constructor(message = 'Invalid item cursor') {
    super(message)
    this.name = 'CursorError'
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_CURSOR_LENGTH = 8192

function filterIdentity(params: NormalizedItemListSearchParams) {
  // Filters bind the cursor to a query; hashing keeps long search text out of the URL token.
  return createHash('sha256').update(JSON.stringify(params)).digest('base64url')
}

function encode(value: EncodedItemCursor) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function decode(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  } catch {
    throw new CursorError()
  }
}

function assertKey(params: NormalizedItemListSearchParams, key: unknown): asserts key is ItemCursorKey {
  if (params.sort_by === 'quantity' && (!Number.isFinite(key) || typeof key !== 'number')) {
    throw new CursorError()
  }
  if (params.sort_by === 'updated_at' && (typeof key !== 'string' || key.length > 64 || !Number.isFinite(Date.parse(key)))) {
    throw new CursorError()
  }
  if (params.sort_by === 'item_type' && (typeof key !== 'string' || !itemTypes.includes(key as ItemType))) {
    throw new CursorError()
  }
  if (params.sort_by === 'status' && (typeof key !== 'string' || !itemStatuses.includes(key as ItemStatus))) {
    throw new CursorError()
  }
  if (params.sort_by === 'item_name' && (typeof key !== 'string' || key.length > 512)) {
    throw new CursorError()
  }
}

export function encodeItemCursor(params: NormalizedItemListSearchParams, key: ItemCursorKey, id: string) {
  assertKey(params, key)
  if (!UUID.test(id)) throw new CursorError()
  return encode({ v: 1, filters: filterIdentity(params), key, id })
}

export function decodeItemCursor(cursor: string, params: NormalizedItemListSearchParams): { key: ItemCursorKey; id: string } {
  if (!cursor || cursor.length > MAX_CURSOR_LENGTH) throw new CursorError()
  const value = decode(cursor)
  if (!value || typeof value !== 'object') throw new CursorError()
  const parsed = value as Partial<EncodedItemCursor>
  if (parsed.v !== 1 || parsed.filters !== filterIdentity(params) || typeof parsed.id !== 'string' || !UUID.test(parsed.id)) {
    throw new CursorError()
  }
  assertKey(params, parsed.key)
  return { key: parsed.key, id: parsed.id }
}

/** Escapes a PostgREST quoted literal used only in a generated `.or()` predicate. */
export function escapePostgrestLiteral(value: string) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}
