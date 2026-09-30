import { createAdminClient, createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { isPostgresBackend } from '@/lib/backend'

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

type BatchSignedUrlsResult = {
  data: { error: string | null; path: string | null; signedUrl: string | null }[] | null
  error: unknown | null
}

export async function resolvePrivateItemImageUrl(
  imageUrl: string | null | undefined,
  createSignedUrl: (path: string, expiresIn: number) => Promise<SignedUrlResult>
): Promise<string | null> {
  if (isPostgresBackend()) {
    const { resolveLocalItemImageUrl } = await import('@/lib/postgres/storage')
    return resolveLocalItemImageUrl(imageUrl)
  }
  const filePath = parseStoragePathFromUrl(imageUrl)
  if (!filePath) return null

  const { data, error } = await createSignedUrl(filePath, 60 * 60)
  return error || !data?.signedUrl ? null : data.signedUrl
}

export async function resolvePrivateItemImageUrlsBatch(
  imageUrls: (string | null | undefined)[],
  createSignedUrls: (paths: string[], expiresIn: number) => Promise<BatchSignedUrlsResult>
): Promise<(string | null)[]> {
  if (isPostgresBackend()) {
    const { resolveLocalItemImageUrl } = await import('@/lib/postgres/storage')
    return Promise.all(imageUrls.map((url) => resolveLocalItemImageUrl(url)))
  }

  const pathMap = new Map<number, string>()
  const uniquePaths: string[] = []

  imageUrls.forEach((url, index) => {
    const filePath = parseStoragePathFromUrl(url)
    if (filePath) {
      pathMap.set(index, filePath)
      if (!uniquePaths.includes(filePath)) {
        uniquePaths.push(filePath)
      }
    }
  })

  if (uniquePaths.length === 0) {
    return imageUrls.map(() => null)
  }

  const { data, error } = await createSignedUrls(uniquePaths, 60 * 60)
  const signedUrlMap = new Map<string, string>()

  if (!error && data) {
    for (let i = 0; i < data.length; i++) {
      const entry = data[i]
      if (entry && entry.signedUrl && !entry.error) {
        if (entry.path) {
          signedUrlMap.set(entry.path, entry.signedUrl)
        }
        if (uniquePaths[i]) {
          signedUrlMap.set(uniquePaths[i], entry.signedUrl)
        }
      }
    }
  }

  return imageUrls.map((_, index) => {
    const path = pathMap.get(index)
    if (!path) return null
    return signedUrlMap.get(path) ?? null
  })
}

export async function deleteItemStorageImage(
  imageUrl: string | null | undefined,
  profile?: { id: string; role: string; is_active: boolean } | null
): Promise<{ success: boolean; error?: string }> {
  if (isPostgresBackend()) {
    const { deleteLocalItemImage } = await import('@/lib/postgres/storage')
    return deleteLocalItemImage(imageUrl, profile)
  }
  const filePath = parseStoragePathFromUrl(imageUrl)
  if (!filePath) return { success: true }

  try {
    let supabase
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        supabase = await createAdminClient()
      } catch {
        supabase = createServiceRoleClient()
      }
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
