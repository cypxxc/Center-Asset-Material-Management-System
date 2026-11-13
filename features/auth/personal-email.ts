import { z } from 'zod'
import { isInternalEmail } from '@/lib/display-email'
import { normalizeForStorage } from '@/lib/unicode'

export function parsePersonalEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = normalizeForStorage(value).trim().toLowerCase()
  if (email.length > 254 || !z.email().safeParse(email).success || isInternalEmail(email)) return null
  return email
}
