import type { ReportItemRow } from '@/features/reports/types'
import { formatDate, formatDateThaiBE } from '@/lib/date'

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

  const tableRowsHtml = items.length > 0
    ? items
        .map((item, index) => {
          const unitPrice = item.unit_price ?? 0
          const brandModel = [item.brand, item.model].filter(Boolean).join(' ')
          const isUsable = item.status === 'active' || item.status === 'spare'
          const isDamaged = item.status === 'damaged' || item.status === 'waiting_repair'
          const isDeteriorated = item.status === 'inactive' || item.status === 'disposed'

          return `
            <tr>
              <td style="text-align: center; font-variant-numeric: tabular-nums;">${index + 1}</td>
              <td style="text-align: center; white-space: nowrap;">${item.acquired_date ? formatDateThaiBE(item.acquired_date) : '-'}</td>
              <td style="word-break: break-word;">${escapeHtml(item.budget_source || '-')}</td>
              <td style="word-break: break-word; font-weight: 500;">${escapeHtml(item.item_name)}</td>
              <td style="word-break: break-word;">
                ${escapeHtml(brandModel || '-')}
                ${item.serial_no ? `<br><small style="color: #64748b; font-family: monospace;">s/n : ${escapeHtml(item.serial_no)}</small>` : ''}
              </td>
              <td style="text-align: right; font-variant-numeric: tabular-nums;">${formatCurrency(unitPrice)}</td>
              <td style="text-align: center;">${escapeHtml(item.unit?.name || 'เครื่อง')}</td>
              <td style="font-family: monospace; font-size: 10px; word-break: break-all;">${escapeHtml(item.asset_no || '-')}</td>
              <td style="font-family: monospace; font-size: 10px; text-align: center;">${escapeHtml(item.gfmis_number || '-')}</td>
              <td>${escapeHtml(item.responsible_person || '-')}</td>
              <td>${escapeHtml(item.location?.name || '-')}</td>
              <td style="text-align: center; font-weight: bold; font-size: 13px;">${isUsable ? '/' : ''}</td>
              <td style="text-align: center; font-weight: bold; font-size: 13px; color: #dc2626;">${isDamaged ? '/' : ''}</td>
              <td style="text-align: center; font-weight: bold; font-size: 13px; color: #d97706;">${isDeteriorated ? '/' : ''}</td>
              <td>${escapeHtml(item.note || 'ส่วนกลาง')}</td>
            </tr>
          `
        })
        .join('')
    : `
        <tr>
          <td colspan="15" style="text-align: center; padding: 24px; color: #64748b;">
            ไม่พบข้อมูลสิ่งของตามตัวกรองที่ระบุ
          </td>
        </tr>
      `

  const html = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>รายงานทะเบียนครุภัณฑ์และพัสดุสำนักงาน (CAMMS Portal)</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 12mm 12mm 12mm;
      @bottom-right {
        content: "หน้า " counter(page) " / " counter(pages);
        font-family: 'IBM Plex Sans Thai', 'TH Sarabun New', sans-serif;
        font-size: 9pt;
        color: #64748b;
      }
      @bottom-left {
        content: "CAMMS Portal — Center Asset & Material Management System";
        font-family: 'IBM Plex Sans Thai', 'TH Sarabun New', sans-serif;
        font-size: 9pt;
        color: #64748b;
      }
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: 'IBM Plex Sans Thai', 'TH Sarabun New', 'TH Sarabun PSK', 'Leelawadee UI', system-ui, -apple-system, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
      background: #ffffff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #1e293b;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .title {
      font-size: 18px;
      font-weight: bold;
      color: #0f172a;
      margin: 0 0 4px 0;
    }
    .subtitle {
      font-size: 11px;
      color: #475569;
      margin: 0;
    }
    .header-logo {
      height: 38px;
      width: auto;
      object-fit: contain;
    }
    .logo-text {
      text-align: right;
    }
    .logo-text h2 {
      margin: 0;
      font-size: 16px;
      color: #1e293b;
    }
    .logo-text p {
      margin: 2px 0 0 0;
      font-size: 10px;
      color: #64748b;
    }
    .filter-summary {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 11px;
      color: #334155;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      vertical-align: middle;
      font-size: 11px;
    }
    th {
      background-color: #1e293b;
      color: #ffffff;
      font-weight: bold;
      text-align: left;
      font-size: 11px;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: bold;
      background-color: #e2e8f0;
      color: #334155;
    }
    .status-active {
      background-color: #dcfce7;
      color: #166534;
    }
    .status-damaged, .status-waiting_repair {
      background-color: #fef3c7;
      color: #92400e;
    }
    .status-inactive, .status-disposed {
      background-color: #fee2e2;
      color: #991b1b;
    }
    .summary-box {
      display: flex;
      justify-content: flex-end;
      gap: 20px;
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 10px 14px;
      border-radius: 4px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .summary-item {
      font-size: 12px;
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
      margin-top: 24px;
      page-break-inside: avoid;
    }
    .signature-box {
      width: 45%;
      text-align: center;
      font-size: 11px;
      line-height: 1.8;
    }
    .dots {
      margin-bottom: 6px;
    }
    .page-footer {
      display: none;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page-footer {
        display: flex;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        justify-content: space-between;
        font-size: 9px;
        color: #64748b;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; align-items: center; gap: 12px;">
      <img src="/images/moph-r7-logo.png" alt="เขตสุขภาพที่ 7" class="header-logo" />
      <div>
        <h1 class="title">ทะเบียนคุมสินทรัพย์</h1>
        <p class="subtitle" style="font-size: 13px; font-weight: 500; color: #1e293b;">บัญชีแสดงรายการพัสดุคงเหลือ (ครุภัณฑ์ตามเกณฑ์)</p>
        <p class="subtitle">หน่วยงาน: สำนักงานเขตสุขภาพที่ 7 | หมวดครุภัณฑ์: ${escapeHtml(filterSummary)} | วันที่พิมพ์รายงาน: ${currentDate}</p>
      </div>
    </div>
    <div class="logo-text">
      <h2>CAMMS Portal</h2>
      <p>Center Asset & Material Management System</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th rowspan="2" style="width: 3%; text-align: center;">ลำดับ</th>
        <th rowspan="2" style="width: 6%; text-align: center;">วัน เดือน ปีที่รับ</th>
        <th rowspan="2" style="width: 8%;">รับจาก (งปม.)</th>
        <th rowspan="2" style="width: 16%;">รายการครุภัณฑ์</th>
        <th rowspan="2" style="width: 14%;">ยี่ห้อ/รุ่น</th>
        <th rowspan="2" style="width: 7%; text-align: right;">ราคา</th>
        <th rowspan="2" style="width: 4%; text-align: center;">หน่วย</th>
        <th rowspan="2" style="width: 11%;">เลขครุภัณฑ์</th>
        <th rowspan="2" style="width: 8%; text-align: center;">เลขสินทรัพย์</th>
        <th rowspan="2" style="width: 8%;">ผู้ครอบครอง</th>
        <th rowspan="2" style="width: 7%;">ใช้งานที่</th>
        <th colspan="3" style="text-align: center; border-bottom: none;">สภาพพัสดุ</th>
        <th rowspan="2" style="width: 5%;">หมายเหตุ</th>
      </tr>
      <tr>
        <th style="width: 2.6%; text-align: center; font-size: 10px; padding: 4px 2px;">ใช้งานได้</th>
        <th style="width: 2.3%; text-align: center; font-size: 10px; padding: 4px 2px;">ชำรุด</th>
        <th style="width: 2.6%; text-align: center; font-size: 10px; padding: 4px 2px;">เสื่อมสภาพ</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
    </tbody>
  </table>

  <div class="summary-box">
    <div class="summary-item"><span class="label">จำนวนรายการ:</span> <span class="val">${items.length.toLocaleString('th-TH')}</span> รายการ</div>
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
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
          setTimeout(function() {
            window.print();
          }, 150);
        });
      } else {
        setTimeout(function() {
          window.print();
        }, 300);
      }
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
