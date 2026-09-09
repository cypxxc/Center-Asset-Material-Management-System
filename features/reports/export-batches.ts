export const EXPORT_BATCH_SIZE = 500
export const PDF_EXPORT_LIMIT = 5000
export type ExportCursor = { id: string; value: unknown }
export type ExportBatch<T> = { items: T[]; next_cursor: ExportCursor | null }

/** Bounded memory; cursor and count checks prevent silently accepting partial files. */
export async function* walkReportBatches<T extends { id: string }>(
  load: (cursor: ExportCursor | null) => Promise<ExportBatch<T>>,
  expectedCount: number,
  signal?: AbortSignal,
): AsyncGenerator<T[]> {
  let cursor: ExportCursor | null = null
  let count = 0
  do {
    signal?.throwIfAborted()
    const batch = await load(cursor)
    signal?.throwIfAborted()
    if (!batch || !Array.isArray(batch.items) || batch.items.length > EXPORT_BATCH_SIZE || batch.items.some(item => !item || typeof item.id !== 'string')) {
      throw new Error('Invalid export batch')
    }
    if (new Set(batch.items.map(item => item.id)).size !== batch.items.length) throw new Error('Duplicate export rows')
    const next = batch.next_cursor
    if (next !== null && (!next || typeof next.id !== 'string' || !('value' in next) || next.id === cursor?.id || next.id !== batch.items.at(-1)?.id)) {
      throw new Error('Invalid export cursor')
    }
    count += batch.items.length
    if (count > expectedCount || (next === null && count !== expectedCount)) throw new Error('Export data changed or is incomplete; please retry')
    if (batch.items.length) yield batch.items
    cursor = next
  } while (cursor)
}
