export type PoolEventType = 'handover' | 'borrow' | 'return' | 'reversal' | 'assignment'

export interface PoolAuditEvidence {
  id: string
  item_name: string
  asset_no: string | null
  is_central: boolean
  note: string | null
  event_type: PoolEventType
  item_condition: string | null
  event_at: string
  document_no: string | null
  document_id: string | null
  active_borrow: boolean
}

export interface PoolAuditFinding extends PoolAuditEvidence {
  expected_central: boolean
  reason: string
  flag_mismatch: boolean
  note_mismatch: boolean
}

export function findPoolMismatch(row: PoolAuditEvidence): PoolAuditFinding | null {
  const expected = !row.active_borrow && (row.event_type === 'reversal' || (row.event_type === 'return' && row.item_condition !== 'lost'))
  const flagMismatch = row.is_central !== expected
  const noteMismatch = Boolean(row.note?.includes('ส่วนกลาง')) !== expected
  if (!flagMismatch && !noteMismatch) return null
  const reason = row.active_borrow ? 'ยังอยู่ระหว่างการยืม'
    : row.event_type === 'return' ? row.item_condition === 'lost' ? 'บันทึกสูญหายจากการยืม' : 'มีประวัติรับคืนแล้ว'
      : row.event_type === 'reversal' ? 'มีประวัติย้อนรายการแล้ว'
        : row.event_type === 'borrow' ? 'มีประวัติจ่ายยืมแล้ว' : 'มีประวัติจ่าย / มอบหมายผู้ถือครองแล้ว'
  return { ...row, expected_central: expected, flag_mismatch: flagMismatch, note_mismatch: noteMismatch, reason }
}
