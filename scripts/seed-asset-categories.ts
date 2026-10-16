import { parse } from 'dotenv'
import { readFileSync, existsSync } from 'node:fs'
import { Pool } from 'pg'
import { normalizeForStorage } from '../lib/unicode'

function getConnectionString(): string {
  if (existsSync('.env.postgres.app')) {
    const env = parse(readFileSync('.env.postgres.app'))
    if (env.DATABASE_MIGRATION_URL) return env.DATABASE_MIGRATION_URL
  }
  if (existsSync('.env.local')) {
    const env = parse(readFileSync('.env.local'))
    if (env.DATABASE_MIGRATION_URL) return env.DATABASE_MIGRATION_URL
    if (env.DATABASE_URL) return env.DATABASE_URL
  }
  if (process.env.DATABASE_MIGRATION_URL) return process.env.DATABASE_MIGRATION_URL
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  throw new Error('No database connection configuration found.')
}

export const assetCategories = [
  { code: '7110', name: '7110 - ครุภัณฑ์สำนักงาน', color: '#10B981' },
  { code: '7440', name: '7440 - ครุภัณฑ์คอมพิวเตอร์', color: '#3B82F6' },
  { code: '7430', name: '7430 - ครุภัณฑ์โฆษณาและเผยแพร่', color: '#8B5CF6' },
  { code: '5805', name: '5805 - ครุภัณฑ์โทรคมนาคม', color: '#06B6D4' },
  { code: '4120', name: '4120 - ครุภัณฑ์ไฟฟ้าและวิทยุ', color: '#F59E0B' },
  { code: '2310', name: '2310 - ยานพาหนะและขนส่ง', color: '#F97316' },
  { code: '6625', name: '6625 - ครุภัณฑ์วิทยาศาสตร์', color: '#14B8A6' },
  { code: '6515', name: '6515 - ครุภัณฑ์การแพทย์', color: '#EF4444' },
  { code: '6910', name: '6910 - ครุภัณฑ์การศึกษา', color: '#6366F1' },
  { code: '3805', name: '3805 - ครุภัณฑ์การเกษตร', color: '#0EA5E9' },
  { code: '3410', name: '3410 - ครุภัณฑ์โรงงาน', color: '#78716C' },
  { code: '7810', name: '7810 - ครุภัณฑ์งานบ้านงานครัว', color: '#EC4899' },
  { code: '7820', name: '7820 - ครุภัณฑ์กีฬา', color: '#D946EF' },
]

async function seed() {
  const connectionString = getConnectionString()
  const pool = new Pool({ connectionString })
  const client = await pool.connect()

  try {
    const adminRes = await client.query(
      "SELECT id FROM public.profiles WHERE role = 'admin' AND is_active = true LIMIT 1"
    )
    const adminId = adminRes.rows[0]?.id

    await client.query('BEGIN')

    if (adminId) {
      await client.query("SELECT set_config('app.user_id', $1, true)", [adminId])
    }

    const inserted: Array<{ id: string; name: string; description: string | null; color: string; is_active: boolean }> = []

    for (const item of assetCategories) {
      const cleanName = normalizeForStorage(item.name)
      const cleanDesc = normalizeForStorage(item.code)
      const color = item.color

      const res = await client.query(
        `INSERT INTO public.categories (name, description, color, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (name) DO UPDATE
         SET description = EXCLUDED.description, color = EXCLUDED.color, is_active = true, updated_at = now()
         RETURNING id, name, description, color, is_active`,
        [cleanName, cleanDesc, color]
      )

      inserted.push(res.rows[0])
    }

    await client.query('COMMIT')

    console.log(`Successfully seeded ${inserted.length} categories:`)
    console.table(inserted.map((c) => ({ ID: c.id, Name: c.name, Code: c.description, Color: c.color, Active: c.is_active })))
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to seed categories:', error)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
