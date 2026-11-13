/** Keep the legacy note marker aligned with the explicit central-pool flag. */
export function syncCentralNote(note: string, isCentral: boolean): string {
  if (isCentral) {
    return note.includes('ส่วนกลาง') ? note : [note.trimEnd(), 'ส่วนกลาง'].filter(Boolean).join('\n')
  }
  return note.replaceAll('ส่วนกลาง', '').split('\n').filter(line => line.trim() !== '').join('\n').trim()
}
