import { Pool } from 'pg'
import { parse } from 'dotenv'
import { readFileSync } from 'node:fs'

async function setup() {
  const env = parse(readFileSync('.env.postgres.app'))
  const pool = new Pool({ connectionString: env.DATABASE_MIGRATION_URL })

  await pool.query("UPDATE public.profiles SET password = $1 WHERE email = 'admin@camms.local'", ['Admin1234!'])
  console.log('Admin password updated successfully via owner pool')

  const existing = await pool.query("SELECT id FROM public.profiles WHERE email = 'uat_user@camms.local'")
  if (existing.rows.length > 0) {
    await pool.query("UPDATE public.profiles SET password = $1, role = 'user', is_active = true WHERE email = 'uat_user@camms.local'", ['User1234!'])
  } else {
    await pool.query(`
      INSERT INTO public.profiles (email, full_name, role, is_active, password)
      VALUES ('uat_user@camms.local', 'ผู้ใช้งาน UAT', 'user', true, 'User1234!')
    `)
  }
  console.log('UAT user account setup successfully via owner pool')

  await pool.end()
}

setup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })
