import 'server-only'

import { sql } from 'drizzle-orm'
import { withUserDatabase } from '@/lib/postgres/request'
import type { SettingsDataSection } from './queries'
import type { CategoryRow, LocationRow, SettingsData, UnitRow } from './types'

export async function getPostgresSettingsData(section: SettingsDataSection = 'all'): Promise<SettingsData> {
  return withUserDatabase(async (tx) => {
    const result: SettingsData = { categories: [], locations: [], units: [] }
    if (section === 'all' || section === 'categories') {
      result.categories = (await tx.execute<CategoryRow & Record<string, unknown>>(sql`select id, name, description, is_active, updated_at from public.categories order by name`)).rows
    }
    if (section === 'all' || section === 'locations') {
      result.locations = (await tx.execute<LocationRow & Record<string, unknown>>(sql`select id, name, building, floor, room, department, description, is_active, updated_at from public.locations order by name`)).rows
    }
    if (section === 'all' || section === 'units') {
      result.units = (await tx.execute<UnitRow & Record<string, unknown>>(sql`select id, name, is_active, updated_at from public.units order by name`)).rows
    }
    return result
  })
}

export async function getPostgresLocationsOverview() {
  return withUserDatabase(async (tx) => {
    const locations = await tx.execute<Pick<LocationRow, 'id' | 'name' | 'building' | 'floor' | 'room'>>(sql`select id, name, building, floor, room from public.locations where is_active order by name`)
    const items = await tx.execute<{
      id: string; name: string; type: string; qty: number; categoryName: string;
      locationId: string | null; locationName: string; status: string; serialNumber: string;
    }>(sql`select i.id, i.item_name as name, i.item_type as type, i.quantity as qty,
      coalesce(nullif(c.name, ''), 'ทั่วไป') as "categoryName", l.id as "locationId",
      coalesce(nullif(l.name, ''), 'ไม่มีระบุสถานที่') as "locationName", i.status,
      coalesce(nullif(i.serial_no, ''), nullif(i.asset_no, ''), '-') as "serialNumber"
      from public.items i left join public.categories c on c.id = i.category_id
      left join public.locations l on l.id = i.location_id where i.deleted_at is null`)
    return { locations: locations.rows, items: items.rows }
  })
}
