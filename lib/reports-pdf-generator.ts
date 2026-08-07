import { ReportItemRow } from '@/features/reports/queries'
import { ITEM_STATUS_LABELS, ITEM_TYPE_LABELS } from '@/features/items/types'
import { formatDate } from '@/lib/date'

export function generateReportPdf(
  items: ReportItemRow[],
  filterSummary: string,
  totalQty: number,
  totalValue: number
): void {
  if (typeof window === 'undefined') return

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('กรุณาอนุญาต Pop-up ในเบราว์เซอร์เพื่อพิมพ์รายงาน PDF')
    return
  }

  const currentDate = formatDate()

  const formatCurrency = (val: number) =>
    val.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const tableRowsHtml = items
    .map((item, index) => {
      const typeLabel =
        ITEM_TYPE_LABELS[item.item_type as keyof typeof ITEM_TYPE_LABELS] || item.item_type
      const statusLabel =
        ITEM_STATUS_LABELS[item.status as keyof typeof ITEM_STATUS_LABELS] || item.status
      const unitPrice = item.unit_price ?? 0
      const totalRowVal = unitPrice * item.quantity

      return `
        <tr>
          <td style="text-align: center;">${index + 1}</td>
          <td>
            <strong>${escapeHtml(item.item_name)}</strong>
            ${item.asset_no || item.serial_no ? `<br><small style="color: #64748b;">${escapeHtml(item.asset_no || item.serial_no || '')}</small>` : ''}
          </td>
          <td>${escapeHtml(typeLabel)}</td>
          <td>${escapeHtml(item.category?.name || '-')}</td>
          <td>${escapeHtml(item.location?.name || '-')}</td>
          <td style="text-align: center;">${item.quantity} ${escapeHtml(item.unit?.name || '')}</td>
          <td style="text-align: right;">${formatCurrency(unitPrice)}</td>
          <td style="text-align: right; font-weight: bold;">${formatCurrency(totalRowVal)}</td>
          <td style="text-align: center;">${escapeHtml(statusLabel)}</td>
        </tr>
      `
    })
    .join('')

  const html = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>รายงานทะเบียนทรัพย์สินและวัสดุสำนักงาน (CAMMS)</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm;
    }
    body {
      font-family: 'Sarabun', 'TH Sarabun PSK', system-ui, -apple-system, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 13px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .title {
      font-size: 20px;
      font-weight: bold;
      margin: 0 0 4px 0;
    }
    .subtitle {
      font-size: 12px;
      color: #475569;
      margin: 0;
    }
    .logo-text {
      text-align: right;
    }
    .logo-text h2 {
      margin: 0;
      font-size: 18px;
      color: #2563eb;
    }
    .logo-text p {
      margin: 2px 0 0 0;
      font-size: 11px;
      color: #64748b;
    }
    .filter-summary {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      vertical-align: middle;
    }
    th {
      background-color: #f1f5f9;
      font-weight: bold;
      text-align: left;
      font-size: 12px;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .summary-box {
      display: flex;
      justify-content: flex-end;
      gap: 24px;
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .summary-item {
      font-size: 13px;
    }
    .summary-item span.label {
      font-weight: normal;
      color: #475569;
    }
    .summary-item span.val {
      font-weight: bold;
      color: #0f172a;
    }
    .signature-container {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      page-break-inside: avoid;
    }
    .signature-box {
      width: 45%;
      text-align: center;
      font-size: 12px;
      line-height: 1.8;
    }
    .dots {
      margin-bottom: 8px;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">รายงานทะเบียนทรัพย์สินและวัสดุสำนักงาน (CAMMS)</h1>
      <p class="subtitle">วันที่พิมพ์รายงาน: ${currentDate} | ตัวกรอง: ${escapeHtml(filterSummary)}</p>
    </div>
    <div class="logo-text">
      <h2>Registry-S</h2>
      <p>ระบบควบคุมทรัพย์สินส่วนกลาง</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 5%; text-align: center;">ลำดับ</th>
        <th style="width: 22%;">ชื่อสิ่งของ / เลขพัสดุ</th>
        <th style="width: 10%;">ประเภท</th>
        <th style="width: 12%;">หมวดหมู่</th>
        <th style="width: 12%;">สถานที่</th>
        <th style="width: 10%; text-align: center;">จำนวน</th>
        <th style="width: 11%; text-align: right;">ราคา/หน่วย (บาท)</th>
        <th style="width: 11%; text-align: right;">ราคารวม (บาท)</th>
        <th style="width: 7%; text-align: center;">สถานะ</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <div class="summary-box">
    <div class="summary-item"><span class="label">จำนวนรายการทั้งหมด:</span> <span class="val">${items.length.toLocaleString('th-TH')}</span> รายการ</div>
    <div class="summary-item"><span class="label">จำนวนชิ้นรวม:</span> <span class="val">${totalQty.toLocaleString('th-TH')}</span> ชิ้น</div>
    <div class="summary-item"><span class="label">มูลค่ารวมทั้งสิ้น:</span> <span class="val">${formatCurrency(totalValue)}</span> บาท</div>
  </div>

  <div class="signature-container">
    <div class="signature-box">
      <div class="dots">ลงชื่อ.......................................................... ผู้จัดทำรายงาน</div>
      <div>(..........................................................)</div>
      <div>ตำแหน่ง..........................................................</div>
      <div>วันที่ ..... / ..... / ..........</div>
    </div>
    <div class="signature-box">
      <div class="dots">ลงชื่อ.......................................................... ผู้เห็นชอบ/อนุมัติ</div>
      <div>(..........................................................)</div>
      <div>ตำแหน่ง..........................................................</div>
      <div>วันที่ ..... / ..... / ..........</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
  `

  printWindow.document.write(html)
  printWindow.document.close()
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
