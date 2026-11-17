export interface CropOptions {
  previewWidth: number
  previewHeight: number
  zoom: number
  rotation: number
  offset: { x: number; y: number }
}

export function renderImageCrop(image: HTMLImageElement, options: CropOptions): HTMLCanvasElement {
  // Match the preview's object-contain sizing. Export at source resolution
  // (including zoom), capped at 2400px wide for full-screen viewing.
  const previewScale = Math.min(options.previewWidth / image.naturalWidth,
    options.previewHeight / image.naturalHeight)
  const width = Math.max(4, Math.floor(Math.min(2400,
    options.previewWidth / (previewScale * options.zoom)) / 4) * 4)
  const height = width * 3 / 4
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context not available')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)
  ctx.translate(width / 2 + options.offset.x * width / options.previewWidth,
    height / 2 + options.offset.y * height / options.previewHeight)
  ctx.scale(options.zoom, options.zoom)
  ctx.rotate(options.rotation * Math.PI / 180)
  const scale = previewScale * width / options.previewWidth
  ctx.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2,
    image.naturalWidth * scale, image.naturalHeight * scale)
  return canvas
}
