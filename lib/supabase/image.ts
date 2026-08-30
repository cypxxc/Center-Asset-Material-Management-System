export interface ImageTransformOptions {
  width?: number
  quality?: number
  format?: 'webp' | 'origin'
}

export function getTransformedImageUrl(
  url: string | null | undefined,
  options: ImageTransformOptions = {}
): string {
  if (!url) return ''
  if (!url.includes('/storage/v1/object/public/')) return url

  const { width = 600, quality = 80, format = 'webp' } = options
  const transformedUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/')
  const params = new URLSearchParams()

  if (width) params.set('width', width.toString())
  if (quality) params.set('quality', quality.toString())
  if (format && format !== 'origin') params.set('format', format)

  const queryString = params.toString()
  return queryString ? `${transformedUrl}?${queryString}` : transformedUrl
}
