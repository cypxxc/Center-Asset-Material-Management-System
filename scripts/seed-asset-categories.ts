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
  { code: '7110', name: '7110 - ครุภัณฑ์สำนักงาน' },
  { code: '7440', name: '7440 - ครุภัณฑ์คอมพิวเตอร์' },
  { code: '7430', name: '7430 - ครุภัณฑ์โฆษณาและเผยแพร่' },
  { code: '5805', name: '5805 - ครุภัณฑ์โทรคมนาคม' },
  { code: '4120', name: '4120 - ครุภัณฑ์ไฟฟ้าและวิทยุ' },
  { code: '2310', name: '2310 - ยานพาหนะและขนส่ง' },
  { code: '6625', name: '6625 - ครุภัณฑ์วิทยาศาสตร์' },
  { code: '6515', name: '6515 - ครุภัณฑ์การแพทย์' },
  { code: '6910', name: '6910 - ครุภัณฑ์การศึกษา' },
  { code: '3805', name: '3805 - ครุภัณฑ์การเกษตร' },
  { code: '3410', name: '3410 - ครุภัณฑ์โรงงาน' },
  { code: '7810', name: '7810 - ครุภัณฑ์งานบ้านงานครัว' },
  { code: '7820', name: '7820 - ครุภัณฑ์กีฬา' },
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

    const inserted: Array<{ id: string; name: string; description: string | null; is_active: boolean }> = []

    for (const item of assetCategories) {
      const cleanName = normalizeForStorage(item.name)
      const cleanDesc = normalizeForStorage(item.code)

      const res = await client.query(
        `INSERT INTO public.categories (name, description, is_active)
         VALUES ($1, $2, true)
         ON CONFLICT (name) DO UPDATE
         SET description = EXCLUDED.description, is_active = true, updated_at = now()
         RETURNING id, name, description, is_active`,
        [cleanName, cleanDesc]
      )

      inserted.push(res.rows[0])
    }

    await client.query('COMMIT')

    console.log(`Successfully seeded ${inserted.length} categories:`)
    console.table(inserted.map((c) => ({ ID: c.id, Name: c.name, Code: c.description, Active: c.is_active })))
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
