import type { ItemType, ReferenceOption } from './types'

/** Unknown/legacy types must never leak into either inventory's choices. */
export function categoriesForType<T extends ReferenceOption>(categories: T[], type: ItemType): T[] {
  return categories.filter(category => category.item_type === type)
}
