export const ITEM_STATUSES = ['active', 'damaged', 'inactive'] as const
export type ItemConditionStatus = typeof ITEM_STATUSES[number]

// Compatibility for existing records and older import files; never write legacy values.
export function normalizeItemStatus(status: string): string {
  switch (status) {
    case 'spare': return 'active'
    case 'waiting_repair': return 'damaged'
    case 'disposed':
    case 'deteriorated': return 'inactive'
    default: return status
  }
}

export function itemStatusStorageValues(status: string): string[] {
  switch (normalizeItemStatus(status)) {
    case 'active': return ['active', 'spare']
    case 'damaged': return ['damaged', 'waiting_repair']
    case 'inactive': return ['inactive', 'disposed']
    default: return []
  }
}
