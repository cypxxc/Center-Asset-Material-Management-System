import { formatDateThaiBE } from '@/lib/date'

export function materialNoteForDisplay(note: string | null | undefined): string {
  if (!note) return '- ไม่มีหมายเหตุ -'
  try {
    const data: unknown = JSON.parse(note)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return note
    const metadata = data as Record<string, unknown>
    if (typeof metadata.source_key !== 'string' || !metadata.source_key.startsWith('[CAMMS-MATERIAL-')) return note
    const lines: string[] = []
    if (typeof metadata.source_file === 'string' && metadata.source_file.trim()) lines.push(`ไฟล์ต้นทาง: ${metadata.source_file}`)
    if (typeof metadata.source_row === 'number' && Number.isSafeInteger(metadata.source_row) && metadata.source_row > 0) lines.push(`แถวในไฟล์: ${metadata.source_row}`)
    if (typeof metadata.as_of === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(metadata.as_of) && Number.isFinite(Date.parse(metadata.as_of))) {
      lines.push(`วันที่ยอดตามบัญชี: ${formatDateThaiBE(metadata.as_of)}`)
    }
    return lines.join('\n') || 'นำเข้าจากบัญชีวัสดุ'
  } catch {
    return note
  }
}
