export function parseImportCSV(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false, closedQuote = false
  const text = content.replace(/^\uFEFF/, '')
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++ }
      else if (quoted) { quoted = false; closedQuote = true }
      else {
        if (field || closedQuote) throw new Error('ไฟล์ CSV มีเครื่องหมายอัญประกาศผิดรูปแบบ')
        quoted = true
      }
    } else if (char === ',' && !quoted) { row.push(field); field = ''; closedQuote = false }
    else if ((char === '\n' || char === '\r') && !quoted) {
      row.push(field)
      if (row.some(value => value.trim())) rows.push(row)
      row = []; field = ''; closedQuote = false
      if (char === '\r' && text[i + 1] === '\n') i++
    } else {
      if (closedQuote) throw new Error('ไฟล์ CSV มีข้อความอยู่นอกเครื่องหมายอัญประกาศ')
      field += char
    }
  }
  if (quoted) throw new Error('ไฟล์ CSV มีเครื่องหมายอัญประกาศไม่ครบ')
  row.push(field)
  if (row.some(value => value.trim())) rows.push(row)
  return rows
}

export function encodeImportCSV(rows: unknown[][]) {
  return '\uFEFF' + rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n'
}
