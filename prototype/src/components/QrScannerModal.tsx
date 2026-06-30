import React, { useState, useRef, useEffect } from 'react';
import { InventoryItem } from '../types';
import { X, Camera, RefreshCw, AlertCircle, CheckCircle, Volume2 } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  onScanSuccess: (item: InventoryItem) => void;
}

export default function QrScannerModal({ isOpen, onClose, items, onScanSuccess }: QrScannerModalProps) {
  const [useRealCamera, setUseRealCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Stop video stream when closed or toggled
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScannedItem(null);
      setCameraError('');
      setUseRealCamera(false);
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setUseRealCamera(true);
    } catch (err: any) {
      console.error('Failed to get camera access:', err);
      setCameraError('ไม่สามารถเข้าถึงกล้องถ่ายรูปได้ โปรดตรวจสอบสิทธิ์การใช้งานกล้อง');
      setUseRealCamera(false);
    }
  };

  const handleSimulateScan = (item: InventoryItem) => {
    // Play a simulated scan beep using Web Audio API
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1000Hz beep
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15); // Beep for 150ms
    } catch (e) {
      console.log('Audio Context error:', e);
    }

    setScannedItem(item);
    setTimeout(() => {
      onScanSuccess(item);
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-400">qr_code_scanner</span>
            <span className="font-bold">สแกนรหัส QR / บาร์โค้ด</span>
          </div>
          <button onClick={onClose} className="hover:bg-white/10 p-1.5 rounded-full transition-colors text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          
          {/* Main Scanner Window */}
          <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex flex-col items-center justify-center text-slate-400 border border-slate-800 shadow-inner">
            
            {useRealCamera ? (
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-950">
                <span className="material-symbols-outlined text-4xl text-blue-500 animate-pulse">videocam_off</span>
                <p className="text-xs text-slate-400 max-w-xs">
                  กำลังใช้โหมดทดสอบจำลองเพื่อความสะดวก คุณสามารถสลับเปิดกล้องจริงได้ด้านล่าง
                </p>
                <button 
                  onClick={startCamera} 
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Camera className="w-3.5 h-3.5" />
                  เปิดกล้องจริง
                </button>
              </div>
            )}

            {/* Red Laser Line Animation */}
            {!scannedItem && (
              <div className="absolute inset-x-0 h-0.5 bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.8)] top-1/2 -translate-y-1/2 animate-[bounce_2.5s_infinite_ease-in-out]"></div>
            )}

            {/* Corner Bracket Accents */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue-500 rounded-tl"></div>
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue-500 rounded-tr"></div>
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue-500 rounded-bl"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue-500 rounded-br"></div>

            {/* Scan Success Indicator Overlay */}
            {scannedItem && (
              <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center p-4 text-center text-emerald-400 animate-fade-in z-10">
                <CheckCircle className="w-16 h-16 text-emerald-400 animate-[bounce_1s_ease-out_1]" />
                <h4 className="font-bold text-lg mt-3">สแกนรหัสสำเร็จ!</h4>
                <p className="text-xs text-emerald-300 font-semibold mt-1 bg-emerald-900/50 px-2.5 py-1 rounded">
                  {scannedItem.name} ({scannedItem.serialNumber})
                </p>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Simulated Scanner Items Picker */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>เลือกสิ่งของที่ต้องการจำลองสแกน</span>
              <span className="text-[10px] font-normal text-slate-400">คลิกที่รายการเพื่อทดสอบบี๊บเสียง</span>
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {items.filter(item => !item.isDeleted && !item.isArchived).map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSimulateScan(item)}
                  disabled={!!scannedItem}
                  className="flex flex-col text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all text-xs group disabled:opacity-50"
                >
                  <span className="font-bold text-slate-800 group-hover:text-blue-700 truncate w-full">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1">
                    S/N: {item.serialNumber}
                  </span>
                  <div className="flex items-center gap-1 mt-1 text-[9px] text-blue-500 font-semibold">
                    <span className="material-symbols-outlined text-[12px]">qr_code</span>
                    <span>คลิกเพื่อสแกน</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            เปิดเสียงอุปกรณ์เพื่อฟังเสียงบี๊บ
          </span>
          {useRealCamera && (
            <button 
              onClick={stopCamera} 
              className="text-blue-600 font-bold hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> ปิดกล้อง
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
