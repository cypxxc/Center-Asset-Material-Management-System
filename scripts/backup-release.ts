import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) throw new Error('Missing Supabase release-backup environment variables')
const supabaseUrl = url
const supabaseServiceKey = serviceKey

const destinationRoot = process.argv[2]
if (!destinationRoot) throw new Error('Usage: tsx scripts/backup-release.ts <absolute-destination-directory>')
if (!path.isAbsolute(destinationRoot)) throw new Error('Backup destination must be an absolute path')

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const tables = [
  'profiles',
  'categories',
  'locations',
  'units',
  'items',
  'audit_logs',
  'app_migrations',
  'asset_number_templates',
] as const

async function readAllRows(table: string) {
  const rows: unknown[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + 999)
    if (error) throw new Error(`Unable to back up ${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) return rows
  }
}

async function readAllAuthUsers() {
  const users: unknown[] = []
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Unable to back up Auth users: ${error.message}`)
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
}

async function sha256(fileData: Buffer | string) {
  return createHash('sha256').update(fileData).digest('hex')
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
  const backupDir = path.join(destinationRoot, `camms-release-${stamp}`)
  const storageDir = path.join(backupDir, 'storage', 'item-images')
  await mkdir(storageDir, { recursive: true })

  const database: Record<string, unknown[]> = Object.fromEntries(
    await Promise.all(tables.map(async (table) => [table, await readAllRows(table)]))
  )
  const authUsers = await readAllAuthUsers()
  const databaseJson = JSON.stringify({ format: 'camms-release-backup', version: 2, exportedAt: new Date().toISOString(), tables: database }, null, 2)
  const authJson = JSON.stringify({ format: 'camms-auth-users', version: 1, exportedAt: new Date().toISOString(), users: authUsers }, null, 2)

  await writeFile(path.join(backupDir, 'database.json'), databaseJson, 'utf8')
  await writeFile(path.join(backupDir, 'auth-users.json'), authJson, 'utf8')

  const { data: objects, error: listError } = await supabase.storage.from('item-images').list('', { limit: 1000 })
  if (listError) throw new Error(`Unable to list item-images: ${listError.message}`)
  const storageFiles: Array<{ name: string; bytes: number; sha256: string }> = []
  for (const object of objects ?? []) {
    if (!object.name || object.id === null) continue
    const { data, error } = await supabase.storage.from('item-images').download(object.name)
    if (error) throw new Error(`Unable to download item-images/${object.name}: ${error.message}`)
    const buffer = Buffer.from(await data.arrayBuffer())
    await writeFile(path.join(storageDir, object.name), buffer)
    storageFiles.push({ name: object.name, bytes: buffer.length, sha256: await sha256(buffer) })
  }

  const counts = Object.fromEntries(Object.entries(database).map(([table, rows]) => [table, rows.length]))
  const manifest = {
    format: 'camms-release-manifest',
    version: 1,
    exportedAt: new Date().toISOString(),
    supabaseProjectRef: new URL(supabaseUrl).hostname.split('.')[0],
    counts: { ...counts, auth_users: authUsers.length, storage_files: storageFiles.length },
    files: {
      'database.json': await sha256(databaseJson),
      'auth-users.json': await sha256(authJson),
      storage: storageFiles,
    },
  }
  await writeFile(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  process.stdout.write(JSON.stringify({ backupDir, counts: manifest.counts }, null, 2))
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`Release backup failed: ${message}\n`)
  process.exitCode = 1
})
