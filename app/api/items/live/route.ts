import { NextResponse } from 'next/server'
import { getCurrentProfile } from '@/features/auth/queries'
import { profileRevision } from '@/features/auth/profile-revision'
import { getItems, getSidebarData } from '@/features/items/queries'
import { itemListQuery } from '@/features/items/list-query'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

export async function GET(request: Request) {
  const profile = await getCurrentProfile()
  if (!profile?.is_active) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
  const params = Object.fromEntries(itemListQuery(Object.fromEntries(new URL(request.url).searchParams)))
  try {
    // Same cookie-bound RLS and private image signing as the server page.
    const [items, sidebarData] = await Promise.all([getItems(params), getSidebarData()])
    return NextResponse.json({ ...items, sidebarData, authRevision: profileRevision(profile) }, { headers })
  } catch {
    return NextResponse.json({ error: 'Unable to refresh items' }, { status: 503, headers })
  }
}
