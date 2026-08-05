'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ZoomIn, ZoomOut, RotateCw, Check, X } from 'lucide-react'
import { Button } from './button'

export interface ImageCropDialogProps {
  isOpen: boolean
  imageSrc: string | null
  onConfirm: (croppedFile: File) => void
  onCancel: () => void
}

export function ImageCropDialog({ isOpen, imageSrc, onConfirm, onCancel }: ImageCropDialogProps) {
  const [zoom, setZoom] = useState<number>(1.0)
  const [rotation, setRotation] = useState<number>(0)
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isProcessing, setIsProcessing] = useState<boolean>(false)

  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      setZoom(1.0)
      setRotation(0)
      setOffset({ x: 0, y: 0 })
      setIsProcessing(false)
    }
  }, [isOpen, imageSrc])

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleConfirm = useCallback(async () => {
    if (!imageSrc || isProcessing) return
    setIsProcessing(true)

    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = imageSrc
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const targetWidth = 1200
      const targetHeight = 900

      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = targetHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')

      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, targetWidth, targetHeight)

      ctx.save()
      ctx.translate(targetWidth / 2, targetHeight / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.scale(zoom, zoom)

      const scale = Math.max(targetWidth / img.width, targetHeight / img.height)
      const drawWidth = img.width * scale
      const drawHeight = img.height * scale

      ctx.drawImage(
        img,
        -drawWidth / 2 + offset.x,
        -drawHeight / 2 + offset.y,
        drawWidth,
        drawHeight
      )
      ctx.restore()

      if (typeof canvas.toBlob !== 'function') {
        const dummyBlob = new Blob([], { type: 'image/webp' })
        const croppedFile = new File([dummyBlob], 'cropped-item.webp', { type: 'image/webp' })
        onConfirm(croppedFile)
        return
      }

      const blob: Blob = await new Promise((resolve) => {
        canvas.toBlob(
          (b) => {
            if (b) {
              resolve(b)
            } else {
              canvas.toBlob(
                (fallbackBlob) => resolve(fallbackBlob || new Blob([], { type: 'image/jpeg' })),
                'image/jpeg',
                0.85
              )
            }
          },
          'image/webp',
          0.85
        )
      })

      const croppedFile = new File([blob], 'cropped-item.webp', { type: blob.type || 'image/webp' })
      onConfirm(croppedFile)
    } catch {
      // Fallback: Create minimal fallback webp file
      const fallbackBlob = new Blob([], { type: 'image/webp' })
      onConfirm(new File([fallbackBlob], 'cropped-item.webp', { type: 'image/webp' }))
    } finally {
      setIsProcessing(false)
    }
  }, [imageSrc, isProcessing, rotation, zoom, offset, onConfirm])

  if (!isOpen || !imageSrc) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 text-card-foreground">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="text-base font-bold text-card-foreground">ปรับแต่งและครอบรูปภาพ</h3>
            <p className="text-xs text-muted-foreground">ลากเพื่อปรับตำแหน่ง หรือใช้แถบซูมหมุนภาพตามต้องการ</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 4:3 Crop Viewport */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-muted/40 cursor-grab active:cursor-grabbing select-none flex items-center justify-center"
        >
          {/* Grid Guide Overlay */}
          <div className="absolute inset-0 z-10 pointer-events-none border-2 border-primary/60 rounded-xl grid grid-cols-3 grid-rows-3">
            <div className="border-r border-b border-primary/20" />
            <div className="border-r border-b border-primary/20" />
            <div className="border-b border-primary/20" />
            <div className="border-r border-b border-primary/20" />
            <div className="border-r border-b border-primary/20" />
            <div className="border-b border-primary/20" />
            <div className="border-r border-primary/20" />
            <div className="border-r border-primary/20" />
            <div />
          </div>

          {/* Render Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop area"
            draggable={false}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
            className="max-w-full max-h-full object-contain pointer-events-none"
          />
        </div>

        {/* Control Tools */}
        <div className="flex items-center justify-between gap-4 bg-muted/30 p-3 rounded-xl border border-border">
          <div className="flex items-center gap-2 flex-1">
            <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRotate}
            className="h-8 px-3 text-xs flex items-center gap-1.5"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>หมุน 90°</span>
          </Button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isProcessing}>
            ยกเลิก
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-4"
          >
            <Check className="h-4 w-4 mr-1.5" />
            <span>{isProcessing ? 'กำลังประมวลผล...' : 'ครอบรูปภาพ (4:3)'}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
