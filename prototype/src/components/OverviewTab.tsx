import React from 'react';
import { InventoryItem, ActivityLog } from '../types';
import { LayoutDashboard, ShieldAlert, ShoppingBag, CheckCircle, PackageOpen, AlertTriangle, User, Calendar, PlusCircle, Hammer } from 'lucide-react';

interface OverviewTabProps {
  items: InventoryItem[];
  logs: ActivityLog[];
  onNavigateToTab: (tab: any) => void;
  onQuickAdd: () => void;
}

export default function OverviewTab({ items, logs, onNavigateToTab, onQuickAdd }: OverviewTabProps) {
  // Filter active (non-deleted, non-archived) items
  const activeItems = items.filter(item => !item.isDeleted && !item.isArchived);

  const totalAssets = activeItems.filter(item => item.type === 'Asset').length;
  const totalSupplies = activeItems.filter(item => item.type === 'Supply').reduce((sum, item) => sum + item.qty, 0);
  const damagedItemsCount = activeItems.filter(item => item.status === 'DAMAGED').length;
  
  // High value items (simulated price or just count of active)
  const activeCount = activeItems.filter(item => item.status === 'ACTIVE').length;

  // Find supplies with low stock (< 3 qty or similar)
  const lowStockSupplies = activeItems.filter(item => item.type === 'Supply' && item.qty <= 5);

  // Group items by category for breakdown
  const categoryCounts: { [key: string]: number } = {};
  activeItems.forEach(item => {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + item.qty;
  });

  // Calculate status percentages for visual gauge
  const totalQty = activeItems.reduce((sum, item) => sum + item.qty, 0) || 1;
  const statusCounts = {
    ACTIVE: activeItems.filter(item => item.status === 'ACTIVE').reduce((sum, item) => sum + item.qty, 0),
    STOCK: activeItems.filter(item => item.status === 'IN STOCK').reduce((sum, item) => sum + item.qty, 0),
    DAMAGED: activeItems.filter(item => item.status === 'DAMAGED').reduce((sum, item) => sum + item.qty, 0),
    BORROWED: activeItems.filter(item => item.status === 'BORROWED').reduce((sum, item) => sum + item.qty, 0),
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-slate-50/50">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 -translate-y-6 translate-x-6 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute right-12 bottom-0 translate-y-12 w-32 h-32 bg-indigo-500/20 rounded-full blur-xl"></div>
        
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-white/15 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider">
              Console Dashboard
            </span>
          </div>
          <h2 className="text-2xl font-bold">สวัสดีผู้ใช้งาน, ยินดีต้อนรับสู่แดชบอร์ดครุภัณฑ์</h2>
          <p className="text-xs text-blue-100 max-w-xl">
            นี่คือระบบตรวจสอบสถานะ คลังสิ่งของ และแผนกซ่อมบำรุงในปัจจุบันของออฟฟิศทั้งหมด 
            คุณสามารถสลับไปดูประเภทครุภัณฑ์ ตรวจเช็ควัสดุสิ้นเปลือง หรือสแกน QR Code ได้ทันที
          </p>
          <div className="flex items-center gap-3 pt-3">
            <button 
              onClick={onQuickAdd}
              className="bg-white hover:bg-blue-50 text-blue-800 text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md transform hover:-translate-y-0.5"
            >
              <PlusCircle className="w-4 h-4 text-blue-600" />
              เพิ่มรายการด่วน
            </button>
            <button 
              onClick={() => onNavigateToTab('Assets')}
              className="bg-blue-600/50 hover:bg-blue-600 border border-blue-400/40 hover:border-blue-300 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-all"
            >
              ดูรายการทั้งหมด
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ครุภัณฑ์ทั้งหมด (Assets)</p>
            <h3 className="text-2xl font-black text-slate-800">{totalAssets} ชิ้น</h3>
            <p className="text-[10px] text-green-500 font-semibold flex items-center gap-0.5">
              <CheckCircle className="w-3 h-3" /> ใช้งานอยู่ปกติ {activeCount} ชิ้น
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>laptop_mac</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">วัสดุสิ้นเปลืองในคลัง</p>
            <h3 className="text-2xl font-black text-slate-800">{totalSupplies} หน่วย</h3>
            <p className="text-[10px] text-orange-500 font-semibold flex items-center gap-0.5">
              {lowStockSupplies.length > 0 ? (
                <>
                  <AlertTriangle className="w-3 h-3" /> ใกล้หมด {lowStockSupplies.length} รายการ
                </>
              ) : (
                'ปริมาณวัสดุเพียงพอทั้งหมด'
              )}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl">folder_open</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ชำรุด/ส่งเคลมซ่อมบำรุง</p>
            <h3 className="text-2xl font-black text-red-600">{damagedItemsCount} ชิ้น</h3>
            <p className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5">
              <Hammer className="w-3 h-3" /> รอการดำเนินการเคลมส่งซ่อม
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl text-red-500">videocam</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">สถานที่จัดเก็บหลัก</p>
            <h3 className="text-2xl font-black text-slate-800">4 โซน</h3>
            <p className="text-[10px] text-slate-500">มีอัปเดตระบบตรวจสอบบ่อยที่สุด</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-2xl text-purple-500">location_on</span>
          </div>
        </div>
      </div>

      {/* Main Charts and Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Status Breakdown Bar chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-3">สัดส่วนตามสภาพการใช้งาน (Status)</h3>
            <p className="text-xs text-slate-400 mb-5">ปริมาณอุปกรณ์แยกตามประเภทสถานะปัจจุบันในสำนักงาน</p>
          </div>
          
          <div className="space-y-3.5">
            {/* Active Status */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> ใช้งานปกติ (Active)
                </span>
                <span>{statusCounts.ACTIVE} / {totalQty} ชิ้น</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${(statusCounts.ACTIVE / totalQty) * 100}%` }}></div>
              </div>
            </div>

            {/* In Stock Status */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> เก็บสำรองในคลัง (In Stock)
                </span>
                <span>{statusCounts.STOCK} / {totalQty} ชิ้น</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${(statusCounts.STOCK / totalQty) * 100}%` }}></div>
              </div>
            </div>

            {/* Borrowed Status */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span> บุคลากรขอยืมใช้ (Borrowed)
                </span>
                <span>{statusCounts.BORROWED} / {totalQty} ชิ้น</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-yellow-500 h-full rounded-full transition-all duration-500" style={{ width: `${(statusCounts.BORROWED / totalQty) * 100}%` }}></div>
              </div>
            </div>

            {/* Damaged Status */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> ชำรุด/ขัดข้อง (Damaged)
                </span>
                <span>{statusCounts.DAMAGED} / {totalQty} ชิ้น</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="bg-red-500 h-full rounded-full transition-all duration-500" style={{ width: `${(statusCounts.DAMAGED / totalQty) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Category breakdown progress list */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-3">สถิติตามประเภทสิ่งของ (Category)</h3>
            <p className="text-xs text-slate-400 mb-4">จำแนกปริมาณพัสดุและครุภัณฑ์แยกตามหมวดหมู่การใช้งานหลัก</p>
          </div>
          
          <div className="space-y-3">
            {Object.entries(categoryCounts).map(([cat, count]) => {
              const pct = Math.round((count / totalQty) * 100) || 0;
              return (
                <div key={cat} className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                    <span className="font-semibold text-slate-700">{cat}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-mono text-[11px]">{count} ชิ้น</span>
                    <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{pct}%</span>
                  </div>
                </div>
              );
            })}
            {Object.keys(categoryCounts).length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">ไม่มีข้อมูลหมวดหมู่ในปัจจุบัน</p>
            )}
          </div>
        </div>

        {/* Low stock alerts panel */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-2">วัสดุสิ้นเปลืองใกล้หมดคลัง (Low Stock)</h3>
            <p className="text-xs text-slate-400 mb-4">รายการวัสดุที่มีระดับปริมาณต่ำกว่าเกณฑ์ความปลอดภัย (≤ 5 หน่วย)</p>
          </div>
          
          <div className="space-y-3 overflow-y-auto max-h-[190px] pr-1">
            {lowStockSupplies.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2.5 bg-orange-50/50 hover:bg-orange-50 border border-orange-100/50 rounded-xl transition-all">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-orange-500 bg-orange-100 p-1.5 rounded-lg">chair</span>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{item.name}</p>
                    <p className="text-[10px] text-slate-500">{item.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black text-orange-600">{item.qty} ตัว</p>
                  <p className="text-[9px] text-orange-500 font-bold bg-orange-100/70 px-1.5 py-0.5 rounded-full mt-0.5">ต่ำกว่าเกณฑ์</p>
                </div>
              </div>
            ))}

            {lowStockSupplies.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
                <p className="text-xs text-slate-500">ระดับสินค้าวัสดุทั้งหมดอยู่ในเกณฑ์ปกติ</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Recent Activity Log */}
      <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-soft">
        <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">บันทึกกิจกรรมซ่อมบำรุงและอัปเดตล่าสุด (Activity Log)</h3>
            <p className="text-xs text-slate-400">ประวัติการตรวจสภาพครุภัณฑ์และปรับเปลี่ยนรายละเอียดคลัง</p>
          </div>
          <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">อัปเดตสด</span>
        </div>

        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {logs.slice(0, 8).map((log) => (
            <div key={log.id} className="flex items-start justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all text-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 flex items-center justify-center font-bold font-sans mt-0.5 shadow-sm border border-slate-300">
                  {log.user.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-slate-800">{log.user}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100/50">
                      {log.action}
                    </span>
                    <span className="text-slate-400 font-medium">•</span>
                    <span className="text-slate-700 font-bold hover:underline cursor-pointer">{log.itemName}</span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {log.details}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-mono mt-1 whitespace-nowrap pl-4">
                {new Date(log.timestamp).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}

          {logs.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-6">ไม่มีกิจกรรมการอัปเดตในขณะนี้</p>
          )}
        </div>
      </div>

    </div>
  );
}
