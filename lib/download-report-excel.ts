type DownloadOptions = {
  filename: string
  inventory?: boolean
  filterSummary?: string
}

const DOWNLOAD_ERROR = 'ดาวน์โหลด Excel ไม่สำเร็จ กรุณาลองอีกครั้ง'
const FILTER_KEYS = ['q', 'type', 'status', 'category_id', 'location_id', 'sort_by', 'sort_dir'] as const
type ExportFilters = Partial<Record<(typeof FILTER_KEYS)[number] | 'page', string>>

export async function downloadReportExcel(
  filters: ExportFilters,
  { filename, inventory, filterSummary }: DownloadOptions,
) {
  const query = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    if (filters[key]) query.set(key, filters[key])
  }
  if (inventory) {
    query.set('inventory', '1')
    if (filters.sort_dir !== 'asc' && filters.sort_dir !== 'desc') {
      query.set('sort_dir', filters.sort_by === 'item_name' || filters.sort_by === 'item_type' ? 'asc' : 'desc')
    }
  }
  if (filterSummary) query.set('filter_summary', filterSummary.slice(0, 2000))

  let response: Response
  try {
    response = await fetch(`/api/reports/export?${query}`, { credentials: 'same-origin' })
  } catch {
    throw new Error(DOWNLOAD_ERROR)
  }
  if (!response.ok) {
    const result: unknown = await response.json().catch(() => null)
    const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
      ? result.error
      : DOWNLOAD_ERROR
    throw new Error(message)
  }

  let blob: Blob
  try {
    // Read only the compressed XLSX. An interrupted response must never download a partial file.
    blob = await response.blob()
  } catch {
    throw new Error(DOWNLOAD_ERROR)
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
  } finally {
    link.remove()
    // Give the browser time to start saving before releasing the backing blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
}
