# Image Crop & Compression Utility Design Specification

> **Date:** 2026-08-05  
> **Status:** Approved  
> **Target Module:** `components/ui/image-crop-dialog.tsx` & `features/items/components/item-form.tsx`

---

## 1. Overview & Goal

Enhance the Item Image upload experience in the Center Asset & Material Management System by providing a client-side **Image Crop & Compression Modal (`ImageCropDialog`)**.

When users select an image file in the `ItemForm`, the interactive cropping dialog opens automatically, allowing them to:
- Adjust and pan the image within a fixed **4:3 aspect ratio** frame.
- Zoom in/out via an intuitive zoom slider.
- Rotate the image in 90-degree increments.
- Export the cropped image downscaled to a maximum dimension of **1200x900 pixels** and compressed to **WEBP/JPEG at 85% quality**.

This ensures storage efficiency on Supabase Storage, ultra-fast image load speeds on mobile/desktop UI, and consistent visual presentation across items.

---

## 2. Component & Technical Architecture

### 2.1 `components/ui/image-crop-dialog.tsx` (Client Component)

A standalone UI component built with native HTML5 Canvas API, React 19, Lucide icons, and semantic Tailwind CSS tokens.

#### Props Interface
```typescript
export interface ImageCropDialogProps {
  isOpen: boolean
  imageSrc: string | null
  onConfirm: (croppedFile: File) => void
  onCancel: () => void
}
```

#### Key State & Controls
- `zoom`: number (range 1.0 to 3.0, step 0.1)
- `rotation`: number (0, 90, 180, 270 degrees)
- `offset`: `{ x: number, y: number }` (drag/pan position within viewport)
- `isDragging`: boolean

#### Canvas Render & Export Pipeline
1. Load source image into an in-memory `HTMLImageElement`.
2. Compute destination canvas size: fixed 4:3 ratio up to **1200x900 px**.
3. Apply rotation, scaling, and offset transformation matrix on HTML5 Canvas context.
4. Call `canvas.toBlob((blob) => ..., 'image/webp', 0.85)` (with fallback to `'image/jpeg'`).
5. Convert Blob back to a standard JavaScript `File` object (`cropped-image.webp`).

---

### 2.2 `features/items/components/item-form.tsx` Integration

- Intercept `onChange` event of file input (`#image_file`).
- Read selected file into a temporary Data URL using `FileReader`.
- Open `ImageCropDialog` with the temporary Data URL.
- Upon `onConfirm(croppedFile)`:
  - Assign `croppedFile` to the form's file input using the browser `DataTransfer` API (`input.files = dataTransfer.files`).
  - Generate object URL preview (`URL.createObjectURL(croppedFile)`) for immediate inline form display.
  - Revoke temporary object URLs on change or unmount to prevent memory leaks.
- Upon `onCancel()`:
  - Close modal without modifying existing image/preview.

---

## 3. UI / UX Design & Accessibility

- **Modal Backdrop:** `fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm shadow-2xl`
- **Dialog Box:** `w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5 text-card-foreground`
- **Crop Viewport Container:** `relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-muted/30 cursor-grab active:cursor-grabbing select-none`
- **Crop Overlay Frame:** Centered 4:3 grid guide overlay with subtle border `border-primary/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]`
- **Control Strip:**
  - Zoom slider with `<ZoomIn className="h-4 w-4 text-muted-foreground" />` and `<ZoomOut className="h-4 w-4 text-muted-foreground" />`
  - Rotate button with `<RotateCw className="h-4 w-4" />`
  - Cancel & Confirm action buttons styled with semantic primary tokens.

---

## 4. Verification & Self-Review Checklist

- [x] **No hardcoded colors:** Uses semantic CSS tokens (`bg-card`, `border-border`, `text-card-foreground`, `text-muted-foreground`, `bg-muted`, `text-primary`).
- [x] **Strict Type Safety:** Fully typed TypeScript props and canvas context operations.
- [x] **Clean Error Handling:** Graceful fallback if Canvas export or WebP conversion fails.
- [x] **Automated Tests:** Unit test suite for Canvas export helper and dialog interaction.
