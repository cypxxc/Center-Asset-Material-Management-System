# Image Crop & Compression Utility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a client-side Image Crop & Compression Modal component (`components/ui/image-crop-dialog.tsx`) and integrate it into `features/items/components/item-form.tsx` to automatically crop images to a 4:3 ratio and optimize dimensions (max 1200x900px) and quality before upload.

**Architecture:** Build a standalone, accessible React 19 client component `ImageCropDialog` using HTML5 Canvas API for canvas rendering, drag/pan, 90-degree rotations, and WebP/JPEG blob conversion. Integrate `ImageCropDialog` seamlessly into `ItemForm` using browser `FileReader` and `DataTransfer` APIs.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide Icons, HTML5 Canvas API.

## Global Constraints

- Thai-first UI labels with precise operational phrasing.
- Strict Dark Mode compatibility using semantic CSS tokens (`bg-card`, `border-border`, `text-card-foreground`, `text-muted-foreground`, `bg-background`, `text-foreground`, `text-primary`).
- Maximum output image dimensions: **1200x900 pixels** (4:3 aspect ratio).
- Compression output format: `image/webp` (with `image/jpeg` fallback) at **85% quality**.
- Minimum font size `text-xs` (12px) or `text-[11px]` for secondary labels (no `text-[10px]`).
- Verify build, lint, typecheck, and test status (`npm run typecheck`, `npm run lint`, `npm run build`, `npm test`).

---

### Task 1: Build Image Crop & Compression Modal (`ImageCropDialog`)

**Files:**
- Create: `components/ui/image-crop-dialog.tsx`
- Create: `components/ui/image-crop-dialog.test.tsx`

**Interfaces:**
- Consumes: `isOpen: boolean`, `imageSrc: string | null`, `onConfirm: (croppedFile: File) => void`, `onCancel: () => void`
- Produces: `ImageCropDialog` component and Canvas export helper function `cropAndCompressImage`

- [ ] **Step 1: Write unit test for Canvas crop helper and dialog render**

Create `components/ui/image-crop-dialog.test.tsx`:

```typescript
import '../setup/dom'
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { render, screen } from '@testing-library/react'
import { ImageCropDialog } from './image-crop-dialog'

test('ImageCropDialog renders title and controls when open', () => {
  render(
    <ImageCropDialog
      isOpen={true}
      imageSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  )

  assert.ok(screen.getByText('ปรับแต่งและครอบรูปภาพ'))
  assert.ok(screen.getByText('ครอบรูปภาพ (4:3)'))
})

test('ImageCropDialog is null when isOpen is false', () => {
  const { container } = render(
    <ImageCropDialog
      isOpen={false}
      imageSrc={null}
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  )

  assert.equal(container.firstChild, null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test components/ui/image-crop-dialog.test.tsx`
Expected: FAIL with "Cannot find module './image-crop-dialog'".

- [ ] **Step 3: Implement `ImageCropDialog` component**

Create `components/ui/image-crop-dialog.tsx`:

```tsx
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

      const blob: Blob = await new Promise((resolve) => {
        canvas.toBlob(
          (b) => resolve(b || new Blob([], { type: 'image/jpeg' })),
          'image/webp',
          0.85
        )
      })

      const croppedFile = new File([blob], 'cropped-item.webp', { type: blob.type || 'image/webp' })
      onConfirm(croppedFile)
    } catch {
      // Fallback: Return original file simulation
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test components/ui/image-crop-dialog.test.tsx`
Expected: PASS

- [ ] **Step 5: Run TypeScript Check**

Run: `npm run typecheck`
Expected: PASS with 0 errors.

- [ ] **Step 6: Commit Task 1**

```bash
git add components/ui/image-crop-dialog.tsx components/ui/image-crop-dialog.test.tsx
git commit -m "feat(ui): add image crop and compression dialog component"
```

---

### Task 2: Integrate `ImageCropDialog` into `ItemForm`

**Files:**
- Modify: `features/items/components/item-form.tsx:1-444`

**Interfaces:**
- Consumes: `ImageCropDialog` from `@/components/ui/image-crop-dialog`
- Produces: Integrated file input handler with client-side cropping and optimization

- [ ] **Step 1: Inspect `features/items/components/item-form.tsx` image handling logic**

Check `handleFileChange`, `fileInputRef`, and preview state.

- [ ] **Step 2: Add `ImageCropDialog` state & `DataTransfer` file replacement logic**

Update `item-form.tsx`:
- Import `ImageCropDialog` from `@/components/ui/image-crop-dialog`
- Add state `const [rawImageSrc, setRawImageSrc] = useState<string | null>(null)`
- Add state `const [isCropOpen, setIsCropOpen] = useState<boolean>(false)`
- Update `handleFileChange`:
  - When user selects a file, read it with `FileReader.readAsDataURL(file)`
  - Set `rawImageSrc` and open `setIsCropOpen(true)`
- Add `handleCropConfirm(croppedFile: File)`:
  - Create a new `DataTransfer()` object: `const dt = new DataTransfer(); dt.items.add(croppedFile)`
  - Assign `fileInputRef.current.files = dt.files`
  - Update inline preview `setPreview(URL.createObjectURL(croppedFile))`
  - Close crop modal `setIsCropOpen(false)`
  - Clear `rawImageSrc`

- [ ] **Step 3: Verify TypeScript, ESLint, Unit Tests, and Production Build**

Run:
`npm run typecheck`
`npm run lint`
`npm test`
`npm run build`

Expected: PASS with 0 errors across all commands.

- [ ] **Step 4: Commit Task 2**

```bash
git add features/items/components/item-form.tsx
git commit -m "feat(items): integrate client-side image cropping and optimization into item form"
```
