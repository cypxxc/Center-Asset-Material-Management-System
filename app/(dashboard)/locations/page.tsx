import 'server-only'

import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/features/auth/queries'
import { getLocationsOverview } from '@/features/settings/queries'
import { LocationsClient } from './locations-client'

export default async function LocationsPage() {
  const [profile, { locations, items }] = await Promise.all([
    getCurrentProfile(),
    getLocationsOverview(),
  ])

  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=inactive')

  return (
    <LocationsClient
      locations={locations}
      items={items}
    />
  )
}
