import React, { useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import { QrCode, CheckCircle, AlertCircle, Camera, RotateCcw } from 'lucide-react';

interface Props {
  activeSession: {
    id: number;
    fiscal_year: number;
    title: string;
  } | null;
  scannedAsset: {
    id: number;
    asset_code: string;
    name: string;
    serial_number: string | null;
    location?: { name: string };
  } | null;
  existingCheck: {
    status: string;
    remarks: string | null;
    checked_at: string;
  } | null;
}

export default function AuditScan({ activeSession, scannedAsset, existingCheck }: Props) {
  const [assetCodeInput, setAssetCodeInput] = useState('');

  const { data, setData, post, processing } = useForm({
    audit_session_id: activeSession?.id ?? 0,
    asset_id: scannedAsset?.id ?? 0,
    status: existingCheck?.status ?? 'found',
    remarks: existingCheck?.remarks ?? '',
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (assetCodeInput.trim()) {
      window.location.href = `/audit/scan?asset_code=${encodeURIComponent(assetCodeInput.trim())}`;
    }
  };

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    post('/audit/scan');
  };

  if (!activeSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 font-sans">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            ไม่มีรอบการตรวจนับที่เปิดอยู่
          </h2>
          <p className="text-sm text-slate-500">
            กรุณาติดต่อผู้ดูแลระบบ (Admin) เพื่อเปิดรอบการตรวจนับพัสดุประจำปีงบประมาณ
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans p-6">
      <Head title="สแกนตรวจนับพัสดุ" />

      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm mb-6">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
            <QrCode className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {activeSession.title} (ปีงบประมาณ {activeSession.fiscal_year})
              </h1>
              <p className="text-xs text-slate-500">สแกน QR Code หรือกรอกรหัสครุภัณฑ์เพื่อตรวจนับ</p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <input
              type="text"
              value={assetCodeInput}
              onChange={(e) => setAssetCodeInput(e.target.value)}
              placeholder="กรอกหรือยิงบาร์โค้ดรหัสครุภัณฑ์..."
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              ค้นหา
            </button>
          </form>
        </div>

        {scannedAsset && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <div className="mb-4">
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {scannedAsset.asset_code}
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {scannedAsset.name}
              </h2>
              <p className="text-sm text-slate-500">
                สถานที่: {scannedAsset.location?.name ?? '-'} | S/N: {scannedAsset.serial_number ?? '-'}
              </p>
            </div>

            {existingCheck && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>
                  ครุภัณฑ์นี้ได้รับการตรวจนับในรอบนี้แล้ว (สถานะเดิม: {existingCheck.status}) สามารถอัปเดตข้อมูลได้
                </span>
              </div>
            )}

            <form onSubmit={handleCheckInSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  สถานะการตรวจพบ
                </label>
                <select
                  value={data.status}
                  onChange={(e) => setData('status', e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="found">พบปกติ (Found)</option>
                  <option value="damaged">ชำรุดเสียหาย (Damaged)</option>
                  <option value="missing">ไม่พบ/สูญหาย (Missing)</option>
                  <option value="relocated">ย้ายสถานที่ (Relocated)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  หมายเหตุเพิ่มเติม
                </label>
                <textarea
                  rows={3}
                  value={data.remarks}
                  onChange={(e) => setData('remarks', e.target.value)}
                  placeholder="เช่น สภาพชำรุดที่ข้อต่อ หรือย้ายไปห้อง 202..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full py-2.5 px-4 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
              >
                {existingCheck ? 'อัปเดตผลการตรวจนับ' : 'ยืนยันการตรวจนับ'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
