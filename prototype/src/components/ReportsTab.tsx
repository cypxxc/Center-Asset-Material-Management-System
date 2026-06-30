import React from 'react';
import { InventoryItem } from '../types';
import { FileText, Download, CheckCircle, AlertTriangle, Calendar, Award, Printer, ShieldAlert } from 'lucide-react';

interface ReportsTabProps {
  items: InventoryItem[];
}

export default function ReportsTab({ items }: ReportsTabProps) {
  const activeItems = items.filter(item => !item.isDeleted && !item.isArchived);

  // Define some mock pricing for value reports (THB)
  const getItemValue = (name: string, category: string): number => {
    const title = name.toLowerCase();
    if (title.includes('dell') || title.includes('latitude') || title.includes('macbook')) return 35000;
    if (title.includes('chair') || title.includes('ergonomic')) return 5500;
    if (title.includes('projector') || title.includes('epson')) return 18900;
    if (title.includes('printer') || title.includes('laserjet')) return 8900;
    if (title.includes('ipad') || title.includes('tablet')) return 16900;
    if (category === 'IT Equipment') return 12000;
    if (category === 'Furniture') return 3000;
    if (category === 'AV') return 9000;
    return 1500;
  };

  const totalAssetsValue = activeItems.reduce((sum, item) => sum + (getItemValue(item.name, item.category) * item.qty), 0);

  // Audit Completion rate
  const itemsAuditedCount = activeItems.filter(item => {
    if (!item.lastAudited) return false;
    const year = parseInt(item.lastAudited.split('-')[0]);
    return year >= 2023; // Audited recently
  }).length;
  const auditProgressPct = activeItems.length > 0 ? Math.round((itemsAuditedCount / activeItems.length) * 100) : 100;

  // Filter items that need immediate audit (arbitrarily those with status DAMAGED or audited long ago, e.g. Oct 10, 2023)
  const overdueAuditItems = activeItems.filter(item => {
    return item.status === 'DAMAGED' || item.lastAudited <= '2023-10-12';
  });

  const exportCSV = () => {
    // Generate CSV content
    const headers = ['ID', 'Name', 'Type', 'Category', 'Quantity', 'Location', 'Custodian', 'Status', 'SerialNumber', 'LastAudited'];
    const rows = activeItems.map(item => [
      item.id,
      `"${item.name.replace(/"/g, '""')}"`,
      item.type,
      item.category,
      item.qty,
      `"${item.location}"`,
      `"${item.custodian}"`,
      item.status,
      item.serialNumber,
      item.lastAudited
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    // Create a blob and link to download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // \uFEFF is the UTF-8 BOM for Thai text in Excel
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Office_Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-slate-50/50 print:bg-white print:p-0">
      
      {/* Header (No print in standard browser view, but beautifully customized) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>รายงานสรุปและวิเคราะห์ผล (Inventory Reports)</span>
          </h2>
          <p className="text-xs text-slate-400">สรุปภาพรวมมูลค่าครุภัณฑ์ อัตราการตรวจเช็ค และส่งออกข้อมูลเป็นไฟล์ Excel/CSV</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>ดาวน์โหลด CSV (Excel)</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>พิมพ์รายงาน (Print / PDF)</span>
          </button>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="hidden print:block p-8 border-b-2 border-slate-900 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black text-slate-900">รายงานครุภัณฑ์สํานักงานประจําปี</h1>
            <p className="text-xs text-slate-500 mt-1">สำนักงานใหญ่ แผนกเทคโนโลยีสารสนเทศและบริหารจัดการทั่วไป</p>
            <p className="text-xs text-slate-500">วันที่พิมพ์รายงาน: {new Date().toLocaleDateString('th-TH')} | จัดเตรียมโดย: เจ้าหน้าที่พัสดุ</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black text-blue-600">OfficeInventory</h2>
            <p className="text-[10px] text-slate-400">ระบบควบคุมทรัพย์สินส่วนกลาง</p>
          </div>
        </div>
      </div>

      {/* Analytical Value Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* Total Assets worth */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ประเมินมูลค่าทรัพย์สินทั้งหมด</p>
          <h3 className="text-2xl font-black text-slate-800 mt-1">
            {totalAssetsValue.toLocaleString('th-TH')} บาท
          </h3>
          <p className="text-[10px] text-slate-500 mt-1">คำนวณตามราคาจำหน่ายเฉลี่ยรวมวัสดุสิ้นเปลือง</p>
        </div>

        {/* Audit Rate bar */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">อัตราการสแกนตรวจสอบเสร็จสิ้น</p>
          <div className="flex items-center justify-between mt-1">
            <h3 className="text-2xl font-black text-emerald-600">
              {auditProgressPct}%
            </h3>
            <span className="text-xs text-slate-500 font-bold">
              {itemsAuditedCount} / {activeItems.length} รายการ
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${auditProgressPct}%` }}></div>
          </div>
        </div>

        {/* Audit Status Medal */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center flex-shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">มาตรฐานการจัดการสิ่งของ</h4>
            <p className="text-xs text-emerald-600 font-bold mt-0.5">ผ่านเกณฑ์คุณภาพดีเยี่ยม (A+)</p>
            <p className="text-[9px] text-slate-400">มีระบบประเมินประวัติการชำรุดรายเดือน</p>
          </div>
        </div>

      </div>

      {/* Overdue Audits / Maintenance Alert */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft">
        <h3 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <span>รายการครุภัณฑ์ที่ครบกำหนดการตรวจเช็คสภาพ (Overdue Audit & Checkups)</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          รายการอุปกรณ์ที่ไม่ได้ทำการกดบันทึกการตรวจสอบความถูกต้องตั้งแต่เดือน ตุลาคม 2023 หรือได้รับการแจ้งชำรุด (DAMAGED)
        </p>

        <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
          {overdueAuditItems.map((item) => (
            <div key={item.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px] text-slate-400 bg-slate-200 p-1.5 rounded-lg">priority_high</span>
                <div>
                  <p className="font-bold text-slate-800">{item.name}</p>
                  <p className="text-[10px] text-slate-400">S/N: {item.serialNumber} | สถานที่: {item.location}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-600">ตรวจนับล่าสุด: {item.lastAudited}</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-700 border border-orange-200 mt-1">
                  ครบกำหนดแล้ว
                </span>
              </div>
            </div>
          ))}

          {overdueAuditItems.length === 0 && (
            <div className="text-center py-6 text-slate-400">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs">อุปกรณ์ครุภัณฑ์ทุกชิ้นได้รับการตรวจสอบสม่ำเสมอ สมบูรณ์ดี!</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Asset Value breakdown list (Print Ready) */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft print:shadow-none print:border-none">
        <h3 className="font-bold text-slate-800 text-sm mb-4">รายงานราคาและทรัพย์สินรายตัว (Asset Ledger Valuation)</h3>
        
        <table className="w-full text-left text-xs text-slate-700 print:text-black">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-500 p-2">
              <th className="py-2.5 px-3">ชื่อครุภัณฑ์</th>
              <th className="py-2.5 px-3">ซีเรียลนัมเบอร์</th>
              <th className="py-2.5 px-3">หมวดหมู่</th>
              <th className="py-2.5 px-3 text-center">จำนวน</th>
              <th className="py-2.5 px-3 text-right">ราคาต่อชิ้น</th>
              <th className="py-2.5 px-3 text-right">ราคารวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeItems.map((item) => {
              const unitPrice = getItemValue(item.name, item.category);
              const totalPrice = unitPrice * item.qty;
              return (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3 font-bold text-slate-800">{item.name}</td>
                  <td className="py-3 px-3 font-mono text-slate-500">{item.serialNumber}</td>
                  <td className="py-3 px-3 text-slate-500">{item.category}</td>
                  <td className="py-3 px-3 text-center font-bold">{item.qty}</td>
                  <td className="py-3 px-3 text-right font-mono">{unitPrice.toLocaleString('th-TH')} บาท</td>
                  <td className="py-3 px-3 text-right font-black font-mono text-slate-800">{totalPrice.toLocaleString('th-TH')} บาท</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-900 bg-slate-50/50 font-black">
              <td colSpan={3} className="py-3 px-3 text-slate-800 text-right font-black text-sm">มูลค่าประเมินรวมทั้งสิ้น:</td>
              <td className="py-3 px-3 text-center font-black text-sm">{activeItems.reduce((sum, i) => sum + i.qty, 0)}</td>
              <td colSpan={2} className="py-3 px-3 text-right font-black text-blue-700 text-sm">{totalAssetsValue.toLocaleString('th-TH')} บาท</td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  );
}
