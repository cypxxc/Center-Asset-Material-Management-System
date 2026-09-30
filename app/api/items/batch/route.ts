import { getCurrentProfile } from '@/features/auth/queries'
import { CursorError } from '@/features/items/cursor'
import { getItemBatch } from '@/features/items/queries'
import { logger } from '@/lib/logging'

const responseHeaders = { 'Cache-Control': 'private, no-store' }

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile()
    if (!profile) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: responseHeaders })
    if (!profile.is_active) return Response.json({ error: 'Forbidden' }, { status: 403, headers: responseHeaders })
    const search = new URL(request.url).searchParams
    const params = Object.fromEntries(
      ['q', 'type', 'status', 'category_id', 'location_id', 'sort_by', 'sort_dir']
        .flatMap((key) => {
          const value = search.get(key)
          return value === null ? [] : [[key, value]]
        }),
    )
    return Response.json(await getItemBatch(params, search.get('cursor') ?? undefined), { headers: responseHeaders })
  } catch (error) {
    if (error instanceof CursorError) {
      return Response.json({ error: 'Invalid cursor' }, { status: 400, headers: responseHeaders })
    }
    logger.error({ operation: 'getItemBatch', feature: 'items' }, error)
    return Response.json({ error: 'Unable to load item data' }, { status: 500, headers: responseHeaders })
  }
}
