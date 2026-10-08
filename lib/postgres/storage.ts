import 'server-only'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { resolve, dirname, sep } from 'node:path'
import { sql } from 'drizzle-orm'
import { getCurrentProfile } from '@/features/auth/queries'
import { AuthorizationError } from '@/lib/errors'
import { withUserDatabase } from './request'
import { withIdentity } from './db'

const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const localImagePattern = new RegExp(`^/api/files/item-images/${uuid}/${uuid}\\.(jpg|png|webp)$`)
const types = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const

export function resolveLocalItemImageUrl(value: string | null | undefined): string | null {
  return typeof value === 'string' && localImagePattern.test(value) ? value : null
}

function imageFilePath(url: string) {
  if (!resolveLocalItemImageUrl(url)) throw new Error('Invalid image path')
  const root = resolve(process.env.LOCAL_STORAGE_PATH || './data/storage')
  const path = resolve(root, url.slice('/api/files/'.length))
  if (!path.startsWith(root + sep)) throw new Error('Invalid image path')
  return path
}

export async function uploadLocalItemImage(file: File): Promise<string> {
  const profile = await getCurrentProfile()
  if (!profile?.is_active || !['admin', 'staff'].includes(profile.role)) throw new Error('Unauthorized')
  if (file.size === 0 || file.size > 5 * 1024 * 1024) throw new Error('ขนาดไฟล์รูปภาพต้องไม่เกิน 5MB')
  const extension = Object.entries(types).find(([, type]) => type === file.type)?.[0]
  if (!extension) throw new Error('กรุณาอัปโหลดไฟล์ JPEG, PNG หรือ WEBP เท่านั้น')
  const bytes = Buffer.from(await file.arrayBuffer())
  const valid = extension === 'jpg' ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    : extension === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  if (!valid) throw new Error('เนื้อหาไฟล์ไม่ตรงกับประเภทรูปภาพ')
  const url = `/api/files/item-images/${profile.id}/${randomUUID()}.${extension}`
  const path = imageFilePath(url)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, bytes, { flag: 'wx', mode: 0o600 })
  return url
}

export async function readLocalItemImage(url: string) {
  if (!resolveLocalItemImageUrl(url)) return null
  const query = sql`select id from public.items where image_url = ${url} and deleted_at is null limit 1`

  // A file is visible if referenced by an active (non-deleted) item in the registry
  // This allows scanning public QR codes while preserving access restrictions.
  let isReferenced = false
  try {
    const exists = await withUserDatabase(async tx => tx.execute(query))
    isReferenced = exists.rows.length > 0
  } catch (err) {
    // Only allow the unauthenticated fallback for auth errors (no session / inactive account).
    // Any other error (DB timeout, connection failure, etc.) is re-thrown to prevent
    // infrastructure failures from inadvertently opening public image access.
    if (!(err instanceof AuthorizationError)) throw err
    const { getDatabase } = await import('./db')
    const exists = await getDatabase().execute(query)
    isReferenced = exists.rows.length > 0
  }

  if (!isReferenced) return null

  try {
    const data = await readFile(imageFilePath(url))
    const extension = url.split('.').pop() as keyof typeof types
    return { data, contentType: types[extension] }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

export async function deleteLocalItemImage(
  url: string | null | undefined,
  callerProfile?: { id: string; role: string; is_active: boolean } | null
): Promise<{ success: boolean; error?: string }> {
  if (!resolveLocalItemImageUrl(url)) return { success: true }
  try {
    const profile = callerProfile ?? await getCurrentProfile()
    if (!profile?.is_active || !['admin', 'staff'].includes(profile.role)) return { success: false, error: 'Unauthorized' }
    const query = sql`select id from public.items where image_url = ${url!} limit 1`
    const referenced = callerProfile
      ? await withIdentity(callerProfile.id, tx => tx.execute(query))
      : await withUserDatabase(tx => tx.execute(query))
    if (referenced.rows.length) return { success: true }
    await unlink(imageFilePath(url!))
    return { success: true }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { success: true }
    return { success: false, error: 'Unable to remove image' }
  }
}
