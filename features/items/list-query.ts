import type { ItemListSearchParams } from './types'

/** Canonical, allowlisted list identity; never accepts caller identity or permissions. */
export function itemListQuery(params: ItemListSearchParams): URLSearchParams {
  const query = new URLSearchParams()
  for (const key of ['q', 'type', 'status', 'category_id', 'location_id', 'page', 'sort_by', 'sort_dir'] as const) {
    if (params[key]) query.set(key, params[key])
  }
  return query
}
