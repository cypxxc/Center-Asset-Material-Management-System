'use client'

import * as React from 'react'
import { Camera, CameraOff, Keyboard, Loader2, ScanLine, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { parseScannedAssetCode, type ParsedScanResult } from '@/lib/qr-scan-parser'

export interface QrScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (result: ParsedScanResult) => void
}

function playScanBeep() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  } catch {
    // Ignore audio context errors
  }
}

export function QrScannerModal({ isOpen, onClose, onScanSuccess }: QrScannerModalProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [hasCamera, setHasCamera] = React.useState<boolean | null>(null)
  const [cameraError, setCameraError] = React.useState<string | null>(null)
  const [manualCode, setManualCode] = React.useState('')
  const [isScanning, setIsScanning] = React.useState(false)

  // Manage Camera stream
  React.useEffect(() => {
    if (!isOpen) {
      return
    }

    let stream: MediaStream | null = null
    let active = true
    let scanInterval: NodeJS.Timeout | null = null

    async function initCamera() {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setHasCamera(false)
        setCameraError('เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องโดยตรง')
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })

        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }

        setHasCamera(true)
        setIsScanning(true)

        // Native BarcodeDetector loop if supported
        const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window
        if (hasBarcodeDetector) {
          const detector = new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (src: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
          })

          scanInterval = setInterval(async () => {
            if (!active || !videoRef.current || videoRef.current.readyState < 2) return
            try {
              const barcodes = await detector.detect(videoRef.current)
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                const raw = barcodes[0].rawValue
                playScanBeep()
                const parsed = parseScannedAssetCode(raw)
                onScanSuccess(parsed)
                onClose()
              }
            } catch {
              // Frame dropped, retry next tick
            }
          }, 250)
        }
      } catch (err: unknown) {
        if (!active) return
        setHasCamera(false)
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('Permission') || msg.includes('NotAllowedError')) {
          setCameraError('ไม่ได้รับอนุญาตให้เข้าถึงกล้อง โปรดอนุญาตในการตั้งค่าของเบราว์เซอร์')
        } else {
          setCameraError('ไม่สามารถเปิดใช้งานกล้องได้ หรือไม่มีกล้องเชื่อมต่อ')
        }
      }
    }

    initCamera()

    return () => {
      active = false
      if (scanInterval) clearInterval(scanInterval)
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
      setHasCamera(null)
      setCameraError(null)
      setIsScanning(false)
    }
  }, [isOpen, onClose, onScanSuccess])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) return
    playScanBeep()
    const parsed = parseScannedAssetCode(manualCode)
    onScanSuccess(parsed)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-scanner-title"
        className="relative w-full max-w-md bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-800 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <div className="p-1.5 bg-emerald-600 rounded-lg text-white">
              <Camera className="h-4 w-4" />
            </div>
            <span id="qr-scanner-title">สแกน QR Code / บาร์โค้ดครุภัณฑ์</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่างสแกน"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Video / Camera Viewport */}
        <div className="relative w-full aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${hasCamera ? 'block' : 'hidden'}`}
          />

          {hasCamera && isScanning && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Target Scan Bounding Box */}
              <div className="relative w-56 h-56 border-2 border-emerald-400 rounded-2xl shadow-lg">
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                
                {/* Animated Scan Line */}
                <div className="w-full h-0.5 bg-emerald-400 shadow-emerald-400/50 shadow-md animate-bounce mt-10" />
              </div>
            </div>
          )}

          {hasCamera === null && (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <span className="text-xs">กำลังเปิดกล้อง...</span>
            </div>
          )}

          {hasCamera === false && (
            <div className="p-6 text-center space-y-2 max-w-xs">
              <div className="p-3 bg-slate-800/80 rounded-full inline-block text-amber-400">
                <CameraOff className="h-6 w-6" />
              </div>
              <p className="text-xs text-slate-300 font-medium">{cameraError || 'ไม่สามารถเปิดกล้องได้'}</p>
              <p className="text-[11px] text-slate-500">คุณสามารถกรอกรหัสด้วยตนเอง หรือใช้เครื่องยิงบาร์โค้ดด้านล่าง</p>
            </div>
          )}
        </div>

        {/* Footer / Manual Input fallback */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="พิมพ์รหัสครุภัณฑ์ หรือใช้เครื่องยิงบาร์โค้ด..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <Button
              type="submit"
              disabled={!manualCode.trim()}
              className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              <ScanLine className="h-3.5 w-3.5 mr-1" />
              ค้นหา
            </Button>
          </form>

          <p className="text-[11px] text-slate-400 text-center">
            รองรับทั้ง QR Code, ลิงก์ระบบ, Barcode Code 128 และเครื่องยิงบาร์โค้ด USB
          </p>
        </div>
      </div>
    </div>
  )
}
