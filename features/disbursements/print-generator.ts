import type { DisbursementRow, DisbursementItemRow } from './types'
import { formatDate } from '@/lib/date'

export const DISBURSEMENT_TYPE_LABELS: Record<string, string> = {
  material_issue: 'เบิกจ่ายพัสดุ',
  asset_handover: 'ส่งมอบครุภัณฑ์',
  asset_borrow: 'ยืมครุภัณฑ์',
}

export const DISBURSEMENT_STATUS_LABELS: Record<string, string> = {
  draft: 'ฉบับร่าง',
  confirmed: 'ยืนยันแล้ว',
  active_borrow: 'กำลังยืม',
  partially_returned: 'คืนบางส่วน',
  returned: 'คืนครบแล้ว',
  reversed: 'คืนสภาพแล้ว',
  cancelled: 'ยกเลิกแล้ว',
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '-'
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function generateDisbursementVoucherHtml(
  doc: DisbursementRow,
  items: DisbursementItemRow[]
): string {
  const formatCurrency = (val: number | null | undefined) =>
    (val ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const typeLabel = DISBURSEMENT_TYPE_LABELS[doc.transaction_type] || doc.transaction_type
  const statusLabel = DISBURSEMENT_STATUS_LABELS[doc.status] || doc.status
  const docDate = doc.confirmed_at ? formatDate(doc.confirmed_at) : formatDate(doc.created_at)

  let totalQty = 0
  let totalValue = 0

  const tableRowsHtml = items.map((item, idx) => {
    const qty = doc.status === 'draft' ? item.requested_qty : item.issued_qty
    const unitPrice = item.unit_price_snapshot ?? 0
    const rowTotal = qty * unitPrice
    totalQty += qty
    totalValue += rowTotal

    const name = item.item_name_snapshot || '-'
    const assetOrSerial = [item.asset_no_snapshot, item.serial_no_snapshot].filter(Boolean).join(' / ')

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="text-align: left;">
          <strong>${escapeHtml(name)}</strong>
          ${assetOrSerial ? `<br><small style="color: #64748b; font-family: monospace;">${escapeHtml(assetOrSerial)}</small>` : ''}
        </td>
        <td style="text-align: center;">${escapeHtml(item.category_name_snapshot || '-')}</td>
        <td style="text-align: center; font-variant-numeric: tabular-nums;">${qty.toLocaleString('th-TH')}</td>
        <td style="text-align: center;">${escapeHtml(item.unit_name_snapshot || '-')}</td>
        <td style="text-align: right; font-variant-numeric: tabular-nums;">${formatCurrency(unitPrice)}</td>
        <td style="text-align: right; font-variant-numeric: tabular-nums;">${formatCurrency(rowTotal)}</td>
      </tr>
    `
  }).join('')

  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>ใบเบิก-จ่ายพัสดุและครุภัณฑ์ (${escapeHtml(doc.document_no || 'DRAFT')})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
      @bottom-right {
        content: "หน้า " counter(page) " / " counter(pages);
        font-family: 'IBM Plex Sans Thai', 'TH Sarabun New', sans-serif;
        font-size: 9pt;
        color: #64748b;
      }
      @bottom-left {
        content: "CAMMS Portal — ศูนย์บริหารจัดการทรัพย์สินและพัสดุ";
        font-family: 'IBM Plex Sans Thai', 'TH Sarabun New', sans-serif;
        font-size: 9pt;
        color: #64748b;
      }
    }
    body {
      font-family: 'IBM Plex Sans Thai', 'TH Sarabun New', Sarabun, sans-serif;
      font-size: 13pt;
      color: #0f172a;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin: 0 0 4px 0;
    }
    .header p {
      font-size: 13pt;
      color: #475569;
      margin: 0;
    }
    .meta-box {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: #f8fafc;
      font-size: 12pt;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      row-gap: 6px;
      column-gap: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 11pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
    }
    th {
      background-color: #f1f5f9;
      font-weight: bold;
      text-align: center;
    }
    .footer-signatures {
      margin-top: 36px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      row-gap: 32px;
      column-gap: 40px;
      page-break-inside: avoid;
    }
    .sig-block {
      text-align: center;
      font-size: 11pt;
    }
    .sig-line {
      margin-top: 40px;
      border-bottom: 1px dotted #475569;
      width: 80%;
      margin-left: auto;
      margin-right: auto;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ใบเบิก-จ่ายพัสดุและครุภัณฑ์</h1>
    <p>CAMMS Portal (Center Asset & Material Management System)</p>
  </div>

  <div class="meta-box">
    <div class="meta-grid">
      <div><strong>เลขที่เอกสาร:</strong> ${escapeHtml(doc.document_no || 'ฉบับร่าง (ยังไม่ยืนยัน)')}</div>
      <div><strong>วันที่ทำรายการ:</strong> ${escapeHtml(docDate)}</div>
      <div><strong>ประเภทรายการ:</strong> ${escapeHtml(typeLabel)}</div>
      <div><strong>สถานะเอกสาร:</strong> ${escapeHtml(statusLabel)}</div>
      <div><strong>ผู้รับพัสดุ / ผู้ยืม:</strong> ${escapeHtml(doc.recipient_name)}</div>
      <div><strong>กลุ่มงาน:</strong> ${escapeHtml(doc.department_name)}</div>
      <div style="grid-column: span 2;"><strong>วัตถุประสงค์:</strong> ${escapeHtml(doc.purpose)}</div>
      ${doc.due_date ? `<div><strong>กำหนดส่งคืน:</strong> ${escapeHtml(formatDate(doc.due_date))}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 5%;">ลำดับ</th>
        <th style="width: 35%;">รายการพัสดุ / เลขทะเบียน</th>
        <th style="width: 15%;">หมวดหมู่</th>
        <th style="width: 10%;">จำนวน</th>
        <th style="width: 10%;">หน่วยนับ</th>
        <th style="width: 12%;">ราคา/หน่วย</th>
        <th style="width: 13%;">รวมมูลค่า</th>
      </tr>
    </thead>
    <tbody>
      ${tableRowsHtml}
      <tr style="background: #f8fafc; font-weight: bold;">
        <td colspan="3" style="text-align: right;">รวมทั้งสิ้น</td>
        <td style="text-align: center; font-variant-numeric: tabular-nums;">${totalQty.toLocaleString('th-TH')}</td>
        <td style="text-align: center;">รายการ</td>
        <td></td>
        <td style="text-align: right; font-variant-numeric: tabular-nums;">${formatCurrency(totalValue)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-signatures">
    <div class="sig-block">
      <div>ลงชื่อ..........................................................ผู้ขอเบิก/ผู้ยืม</div>
      <div style="margin-top: 4px;">(${escapeHtml(doc.recipient_name)})</div>
      <div style="margin-top: 4px; color: #64748b;">วันที่ ......../......../............</div>
    </div>
    <div class="sig-block">
      <div>ลงชื่อ..........................................................ผู้มีอำนาจสั่งจ่าย</div>
      <div style="margin-top: 4px;">(..........................................................)</div>
      <div style="margin-top: 4px; color: #64748b;">วันที่ ......../......../............</div>
    </div>
    <div class="sig-block">
      <div>ลงชื่อ..........................................................ผู้จ่ายพัสดุ</div>
      <div style="margin-top: 4px;">(..........................................................)</div>
      <div style="margin-top: 4px; color: #64748b;">วันที่ ......../......../............</div>
    </div>
    <div class="sig-block">
      <div>ลงชื่อ..........................................................ผู้รับพัสดุ</div>
      <div style="margin-top: 4px;">(..........................................................)</div>
      <div style="margin-top: 4px; color: #64748b;">วันที่ ......../......../............</div>
    </div>
  </div>
</body>
</html>
  `
}
