import React from 'react';
import { Head, Link } from '@inertiajs/react';
import { Package, Plus, QrCode, Search, ShieldCheck } from 'lucide-react';

interface Asset {
  id: number;
  asset_code: string;
  name: string;
  serial_number: string | null;
  cost: string;
  category?: { name: string };
  location?: { name: string };
  unit?: { name: string };
}

interface Props {
  assets: {
    data: Asset[];
    links: any[];
  };
  auth: {
    user: {
      name: string;
      is_admin: boolean;
      is_staff: boolean;
    };
  };
}

export default function AssetsIndex({ assets, auth }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
      <Head title="ทะเบียนครุภัณฑ์" />

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 rounded-lg">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-capriola">
                CAMMS Portal
              </h1>
              <p className="text-xs text-slate-500 font-sarabun">
                ระบบบริหารจัดการทรัพย์สินและพัสดุส่วนกลาง
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/audit/scan"
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>สแกนตรวจนับ</span>
            </Link>

            {auth.user?.is_staff && (
              <button
                type="button"
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>ลงทะเบียนครุภัณฑ์</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              รายการครุภัณฑ์ทั้งหมด
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อหรือรหัสครุภัณฑ์..."
                  className="pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-100/75 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 uppercase text-xs">
              <tr>
                <th className="py-3 px-4">รหัสครุภัณฑ์</th>
                <th className="py-3 px-4">ชื่อรายการ</th>
                <th className="py-3 px-4">หมวดหมู่</th>
                <th className="py-3 px-4">สถานที่จัดเก็บ</th>
                <th className="py-3 px-4 text-right">ราคาทุน (บาท)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {assets.data.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/25">
                  <td className="py-3.5 px-4 font-mono font-medium text-blue-600 dark:text-blue-400">
                    {asset.asset_code}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                    {asset.name}
                  </td>
                  <td className="py-3.5 px-4">{asset.category?.name ?? '-'}</td>
                  <td className="py-3.5 px-4">{asset.location?.name ?? '-'}</td>
                  <td className="py-3.5 px-4 text-right font-mono">
                    {Number(asset.cost).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {assets.data.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    ไม่พบข้อมูลครุภัณฑ์
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
