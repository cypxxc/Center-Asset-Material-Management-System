export function isCentralDisbursementItem(item: { is_central?: boolean | null; note?: string | null }): boolean {
  return item.is_central === true || Boolean(item.note?.includes('ส่วนกลาง'))
}

export function assertCentralDisbursementItem(item: { is_central?: boolean | null; note?: string | null }): void {
  if (!isCentralDisbursementItem(item)) {
    throw new Error('สั่งจ่ายได้เฉพาะรายการที่เป็นของส่วนกลางเท่านั้น')
  }
}
