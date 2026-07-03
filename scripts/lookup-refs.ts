import path from 'path'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const idx = trimmed.indexOf('=')
    if (idx < 0) return
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    if (key && !process.env[key]) process.env[key] = val
  })
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  const [c, l, u] = await Promise.all([
    supabase.from('categories').select('id,name').eq('is_active', true).order('name'),
    supabase.from('locations').select('id,name').eq('is_active', true).order('name'),
    supabase.from('units').select('id,name').eq('is_active', true).order('name'),
  ])

  console.log('CATEGORIES:', JSON.stringify(c.data))
  console.log('LOCATIONS:', JSON.stringify(l.data))
  console.log('UNITS:', JSON.stringify(u.data))
}
main().catch(console.error)

