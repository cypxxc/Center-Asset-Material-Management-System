'use client'

import * as React from "react"
import { QrCode, X, Camera, CameraOff, Send, ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface QrScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onScanSuccess: (scannedText: string) => void
}

export function QrScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
}: QrScannerModalProps) {
  const [cameraError, setCameraError] = React.useState<string | null>(null)
  const [isInitializing, setIsInitializing] = React.useState(true)
  const [manualCode, setManualCode] = React.useState("")

  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const dialogRef = React.useRef<HTMLDivElement | null>(null)

  // Web Audio API Beep Generator (1000Hz for 150ms)
  const playBeep = React.useCallback(() => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      if (!AudioContextClass) return

      const ctx = new AudioContextClass()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "sine"
      osc.frequency.setValueAtTime(1000, ctx.currentTime)
      gain.gain.setValueAtTime(0.3, ctx.currentTime)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } catch {
      // Ignore audio context errors in unsupported/restricted environments
    }
  }, [])

  const stopCameraStream = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const handleSuccess = React.useCallback(
    (scannedText: string) => {
      const trimmed = scannedText.trim()
      if (!trimmed) return

      playBeep()
      stopCameraStream()
      onScanSuccess(trimmed)
      onClose()
    },
    [playBeep, stopCameraStream, onScanSuccess, onClose]
  )

  // Camera stream setup & detection loop
  React.useEffect(() => {
    if (!isOpen) {
      stopCameraStream()
      return
    }

    let isSubscribed = true
    let animFrameId: number | null = null

    setCameraError(null)
    setIsInitializing(true)
    setManualCode("")

    const initCamera = async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error("อุปกรณ์นี้ไม่รองรับการเข้าถึงกล้องผ่านกล้องถ่ายภาพ")
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })

        if (!isSubscribed) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }

        if (isSubscribed) {
          setIsInitializing(false)
        }

        // Start BarcodeDetector scan loop if available
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          try {
            const detector = new (window as any).BarcodeDetector({
              formats: [
                "qr_code",
                "code_128",
                "code_39",
                "ean_13",
                "ean_8",
                "upc_a",
                "upc_e",
              ],
            })

            const scanFrame = async () => {
              if (!isSubscribed || !streamRef.current) return

              if (
                videoRef.current &&
                videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
              ) {
                try {
                  const barcodes = await detector.detect(videoRef.current)
                  if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                    handleSuccess(barcodes[0].rawValue)
                    return
                  }
                } catch {
                  // Ignore frame detection failure
                }
              }

              if (isSubscribed) {
                animFrameId = requestAnimationFrame(scanFrame)
              }
            }

            scanFrame()
          } catch {
            // BarcodeDetector setup failure ignored
          }
        }
      } catch (err: unknown) {
        if (!isSubscribed) return

        let errorMsg =
          "ไม่สามารถเข้าถึงกล้องได้ โปรดตรวจสอบสิทธิ์การใช้งานกล้องในเบราว์เซอร์"
        if (err instanceof Error) {
          if (
            err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError"
          ) {
            errorMsg =
              "ถูกปฏิเสธการเข้าถึงกล้อง โปรดอนุญาตสิทธิ์ใช้งานกล้องในตั้งค่าเบราว์เซอร์"
          } else if (
            err.name === "NotFoundError" ||
            err.name === "DevicesNotFoundError"
          ) {
            errorMsg = "ไม่พบอุปกรณ์กล้องในเครื่องนี้"
          } else if (err.message) {
            errorMsg = err.message
          }
        }

        setCameraError(errorMsg)
        setIsInitializing(false)
      }
    }

    initCamera()

    return () => {
      isSubscribed = false
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId)
      }
      stopCameraStream()
    }
  }, [isOpen, handleSuccess, stopCameraStream])

  // Escape key & trap focus keyboard listener
  React.useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopCameraStream()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose, stopCameraStream])

  if (!isOpen) return null

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualCode.trim()) {
      handleSuccess(manualCode)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={() => {
        stopCameraStream()
        onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-scanner-title"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
            <div className="p-1.5 bg-slate-900 text-white rounded-lg">
              <QrCode className="h-4 w-4" />
            </div>
            <span id="qr-scanner-title">สแกน QR Code / บาร์โค้ด</span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCameraStream()
              onClose()
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่างสแกน"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Video / Camera Frame */}
        <div className="relative bg-slate-950 aspect-square w-full flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Scanner frame graphic overlay */}
          {!cameraError && !isInitializing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8">
              <div className="relative w-full h-full max-w-[240px] max-h-[240px] border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_20px_rgba(52,211,153,0.3)]">
                {/* Corner accents */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                {/* Animated scanning bar */}
                <div className="absolute left-2 right-2 top-2 h-0.5 bg-gradient-to-r from-emerald-500/10 via-emerald-400 to-emerald-500/10 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-bounce" />
              </div>
            </div>
          )}

          {/* Camera Initializing state */}
          {isInitializing && !cameraError && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-slate-300 gap-3 p-4">
              <Camera className="h-8 w-8 animate-pulse text-emerald-400" />
              <p className="text-xs font-medium">กำลังเปิดใช้งานกล้อง...</p>
            </div>
          )}

          {/* Camera Error overlay */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-rose-300 gap-3 p-6 text-center">
              <div className="p-3 bg-rose-500/10 rounded-full text-rose-400">
                <CameraOff className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-rose-200">
                  ไม่สามารถเปิดกล้องได้
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs">
                  {cameraError}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Info & Simulation / Manual input fallback section */}
        <div className="p-4 space-y-3 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>นำกล้องไปส่องที่ QR Code หรือบาร์โค้ด</span>
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <ScanLine className="h-3 w-3" /> Auto detect
            </span>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="กรอกรหัส หรือจำลองการสแกน..."
              className="flex-1 h-8 px-3 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 transition-colors"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!manualCode.trim()}
              className="h-8 px-3 text-xs bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
            >
              <Send className="h-3 w-3 mr-1" />
              ส่งรหัส
            </Button>
          </form>

          {/* Quick simulation buttons for manual testing */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[10px] text-slate-400 font-medium shrink-0">
              ทดสอบสแกน:
            </span>
            <div className="flex flex-wrap gap-1">
              {["ITEM-001", "ITEM-002", "ASSET-100"].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleSuccess(code)}
                  className="px-2 py-0.5 text-[10px] font-mono bg-white hover:bg-slate-200/80 border border-slate-200 rounded text-slate-700 transition-colors cursor-pointer"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 bg-white border-t border-slate-100 flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              stopCameraStream()
              onClose()
            }}
            className="h-8 text-xs cursor-pointer"
          >
            ปิด
          </Button>
        </div>
      </div>
    </div>
  )
}
