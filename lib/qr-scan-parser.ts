/**
 * Utility to parse raw inputs from QR codes and barcode scans.
 * Supports URL links (e.g. https://domain/items/123), UUIDs, and raw asset numbers.
 */

export interface ParsedScanResult {
  type: 'item_id' | 'asset_no'
  value: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function parseScannedAssetCode(rawInput: string): ParsedScanResult {
  const trimmed = rawInput.trim()

  // 1. Check if input is a URL containing /items/{id}
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      const pathname = url.pathname // e.g. /items/item-123
      const parts = pathname.split('/').filter(Boolean)
      const itemsIndex = parts.indexOf('items')
      if (itemsIndex !== -1 && parts[itemsIndex + 1]) {
        return {
          type: 'item_id',
          value: parts[itemsIndex + 1],
        }
      }
    } catch {
      // Fall through to regex or raw code check
    }
  }

  // 2. Check if input matches UUID pattern
  if (UUID_REGEX.test(trimmed)) {
    return {
      type: 'item_id',
      value: trimmed,
    }
  }

  // 3. Otherwise treat as asset / barcode identifier
  return {
    type: 'asset_no',
    value: trimmed,
  }
}
