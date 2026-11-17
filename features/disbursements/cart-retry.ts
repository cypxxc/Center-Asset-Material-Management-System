export type CartRetry = { payload: string; key: string }

export function parseCartRetry(raw: string | null): CartRetry | null {
  try {
    const value: unknown = JSON.parse(raw || 'null')
    if (!value || typeof value !== 'object') return null
    const { payload, key } = value as Partial<CartRetry>
    return typeof payload === 'string' && typeof key === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key) ? { payload, key } : null
  } catch { return null }
}

export function cartRetryPayload(input: { item_ids: string[]; quantities: Record<string, number>; item_actions: Record<string, string>; purpose: string; due_date: string | null; request_type: string }): string {
  const ids = [...input.item_ids].sort()
  return JSON.stringify({ ...input, item_ids: ids, quantities: Object.fromEntries(ids.map(id => [id, input.quantities[id] ?? 1])), item_actions: Object.fromEntries(ids.map(id => [id, input.item_actions[id] ?? input.request_type])), purpose: input.purpose.trim() })
}
