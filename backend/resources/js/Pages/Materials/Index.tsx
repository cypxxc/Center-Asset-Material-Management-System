import React from 'react';
import { Head } from '@inertiajs/react';
import { Boxes, AlertTriangle, Plus } from 'lucide-react';

interface Material {
  id: number;
  sku: string;
  name: string;
  unit_price: string;
  current_quantity: number;
  min_stock_level: number;
  category?: { name: string };
  unit?: { name: string };
}

interface Props {
  materials: {
    data: Material[];
  };
}

export default function MaterialsIndex({ materials }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans p-6">
      <Head title="รายการวัสดุสิ้นเปลือง" />

      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                คลังวัสดุสิ้นเปลือง (Materials)
              </h1>
              <p className="text-xs text-slate-500">
                ควบคุมสต็อก ตรวจสอบจุดสั่งซื้อ และตัดจ่ายพัสดุ
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-100/75 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 text-xs uppercase">
              <tr>
                <th className="py-3 px-4">SKU / รหัสวัสดุ</th>
                <th className="py-3 px-4">ชื่อพัสดุ</th>
                <th className="py-3 px-4 text-center">คงเหลือในคลัง</th>
                <th className="py-3 px-4 text-center">จุดสั่งซื้อขั้นต่ำ</th>
                <th className="py-3 px-4 text-right">ราคาต่อหน่วย</th>
                <th className="py-3 px-4 text-center">สถานะสต็อก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {materials.data.map((item) => {
                const isLow = item.current_quantity <= item.min_stock_level;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25">
                    <td className="py-3 px-4 font-mono font-medium text-emerald-600">{item.sku}</td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{item.name}</td>
                    <td className="py-3 px-4 text-center font-bold">{item.current_quantity} {item.unit?.name}</td>
                    <td className="py-3 px-4 text-center text-slate-400">{item.min_stock_level}</td>
                    <td className="py-3 px-4 text-right">{Number(item.unit_price).toFixed(2)} บาท</td>
                    <td className="py-3 px-4 text-center">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>สต็อกต่ำกว่าเกณฑ์</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          ปกติ
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
