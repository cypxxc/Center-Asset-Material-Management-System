import 'server-only'

import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { createClient } from '@/lib/supabase/server'
import { isPostgresBackend } from '@/lib/backend'
import { getPostgresLocationsOverview } from '@/features/settings/postgres-queries'
import { LocationsClient } from './locations-client'

export default async function LocationsPage() {
  if (isPostgresBackend()) {
    const profile = await getCurrentProfile()
    if (!profile) redirect('/login')
    if (!profile.is_active) redirect('/login?error=inactive')
    const data = await getPostgresLocationsOverview()
    return <LocationsClient {...data} />
  }
  const supabase = await createClient()

  const [profile, locationsResult, itemsResult] = await Promise.all([
    getCurrentProfile(),
    supabase.from('locations').select('id, name, building, floor, room').eq('is_active', true).order('name'),
    supabase.from('items').select(`
      id,
      item_name,
      item_type,
      quantity,
      asset_no,
      serial_no,
      status,
      category:categories(name),
      location:locations(id, name)
    `).is('deleted_at', null),
  ])
  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=inactive')
  const { data: locations, error: locError } = locationsResult
  const { data: items, error: itemsError } = itemsResult

  if (locError) throw new Error(locError.message)

  if (itemsError) {
    throw new Error(itemsError.message)
  }

  interface QueryItemRow {
    id: string
    item_name: string
    item_type: string
    quantity: number
    asset_no: string | null
    serial_no: string | null
    status: string
    category: { name: string } | { name: string }[] | null
    location: { id: string; name: string } | { id: string; name: string }[] | null
  }

  return (
    <LocationsClient
      locations={locations ?? []}
      items={((items as unknown as QueryItemRow[]) ?? []).map((item) => {
        const locObj = Array.isArray(item.location) ? item.location[0] : item.location
        const catObj = Array.isArray(item.category) ? item.category[0] : item.category
        return {
          id: item.id,
          name: item.item_name,
          type: item.item_type,
          qty: item.quantity,
          categoryName: catObj?.name || 'ทั่วไป',
          locationId: locObj?.id || null,
          locationName: locObj?.name || 'ไม่มีระบุสถานที่',
          status: item.status,
          serialNumber: item.serial_no || item.asset_no || '-',
        }
      })}
    />
  )
}
