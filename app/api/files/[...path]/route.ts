import { isPostgresBackend } from '@/lib/backend'
import { readLocalItemImage } from '@/lib/postgres/storage'

export async function GET(_request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (!isPostgresBackend()) return new Response(null, { status: 404 })
  const { path } = await context.params
  const image = await readLocalItemImage(`/api/files/${path.join('/')}`)
  if (!image) return new Response(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
  return new Response(new Uint8Array(image.data), { headers: {
    'Content-Type': image.contentType,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cross-Origin-Resource-Policy': 'same-origin',
  } })
}
