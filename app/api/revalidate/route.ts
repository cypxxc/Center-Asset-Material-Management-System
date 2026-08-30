import { NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache-tags'

/**
 * POST /api/revalidate
 *
 * Busts the Next.js layout cache so the sidebar counts reflect
 * data inserted directly into Supabase (e.g. via MCP tools or seed scripts),
 * bypassing the normal server actions.
 *
 * Security: protected by a shared secret in REVALIDATE_SECRET env var.
 * If the env var is not set the endpoint is disabled (returns 404).
 *
 * Usage:
 *   curl -X POST http://localhost:3000/api/revalidate \
 *     -H "Authorization: Bearer <REVALIDATE_SECRET>"
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret) {
    // Endpoint disabled — don't expose it when not configured
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const auth = request.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Bust the sidebar data cache tag and re-render the whole layout tree
  revalidateTag(CACHE_TAGS.SIDEBAR_DATA, 'max')
  revalidatePath('/', 'layout')

  return NextResponse.json({ revalidated: true, at: new Date().toISOString() })
}
