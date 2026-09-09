import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'

export function parseStoragePathFromUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl || typeof imageUrl !== 'string') return null
  const bucketMarker = '/item-images/'
  const idx = imageUrl.indexOf(bucketMarker)
  if (idx === -1) return null
  const relativePath = imageUrl.substring(idx + bucketMarker.length).split('?')[0]
  return relativePath ? decodeURIComponent(relativePath) : null
}

type SignedUrlResult = {
  data: { signedUrl: string } | null
  error: unknown | null
}

export async function resolvePrivateItemImageUrl(
  imageUrl: string | null | undefined,
  createSignedUrl: (path: string, expiresIn: number) => Promise<SignedUrlResult>
): Promise<string | null> {
  const filePath = parseStoragePathFromUrl(imageUrl)
  if (!filePath) return null

  const { data, error } = await createSignedUrl(filePath, 60 * 60)
  return error || !data?.signedUrl ? null : data.signedUrl
}

/** Sign a page under the caller's storage permissions, without a shared URL cache. */
export async function resolvePrivateItemImageUrls(
  imageUrls: Array<string | null | undefined>,
  createSignedUrls: (paths: string[], expiresIn: number) => Promise<{
    data: Array<{ path?: string | null; signedUrl: string | null; error: string | null }> | null
    error: unknown | null
  }>
): Promise<Array<string | null>> {
  const paths = imageUrls.map(parseStoragePathFromUrl)
  const uniquePaths = [...new Set(paths.filter((path): path is string => !!path))]
  if (!uniquePaths.length) return paths.map(() => null)

  const { data, error } = await createSignedUrls(uniquePaths, 60 * 60)
  const signed = new Map<string, string>()
  if (!error) {
    for (const entry of data ?? []) {
      if (entry.path && !entry.error && entry.signedUrl) signed.set(entry.path, entry.signedUrl)
    }
  }
  return paths.map(path => path ? signed.get(path) ?? null : null)
}

export async function deleteItemStorageImage(imageUrl: string | null | undefined): Promise<{ success: boolean; error?: string }> {
  const filePath = parseStoragePathFromUrl(imageUrl)
  if (!filePath) return { success: true }

  try {
    let supabase
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      supabase = createServiceRoleClient()
    } else {
      supabase = await createClient()
    }
    const { error } = await supabase.storage.from('item-images').remove([filePath])
    if (error) {
      logger.warn({ operation: 'deleteItemStorageImage', feature: 'storage', details: error.message, filePath })
      return { success: false, error: error.message }
    }
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logger.warn({ operation: 'deleteItemStorageImage', feature: 'storage', details: message, filePath })
    return { success: false, error: message }
  }
}
