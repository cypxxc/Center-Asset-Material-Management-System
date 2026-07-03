import { headers } from 'next/headers'
import { getCurrentProfile } from '@/features/auth/queries'
import { RateLimiter } from './types'
import { MemoryRateLimiter } from './memory-rate-limiter'

let globalRateLimiter: RateLimiter

export function getRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new MemoryRateLimiter()
  }
  return globalRateLimiter
}

export interface CheckRateLimitResult {
  success: boolean
  error?: string
}

export async function checkRateLimit(
  actionName: string,
  limitValue = 60,
  windowMs = 60000
): Promise<CheckRateLimitResult> {
  try {
    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '127.0.0.1'

    let userId = 'anonymous'
    try {
      const profile = await getCurrentProfile()
      if (profile?.id) {
        userId = profile.id
      }
    } catch {
      // Gracefully handle auth checks failing in non-HTTP mock contexts (e.g. CLI tests)
    }

    const key = `${userId}:${ip}:${actionName}`
    const limiter = getRateLimiter()
    const result = await limiter.limit(key, limitValue, windowMs)

    if (!result.success) {
      const secondsLeft = Math.ceil((result.reset - Date.now()) / 1000)
      return {
        success: false,
        error: `คุณส่งคำขอมากเกินไป กรุณารออีก ${Math.max(1, secondsLeft)} วินาทีก่อนลองใหม่อีกครั้ง`,
      }
    }

    return { success: true }
  } catch {
    // Return success to fall back gracefully if next/headers cannot be resolved (e.g. unit tests outside request contexts)
    return { success: true }
  }
}

export * from './types'
export * from './memory-rate-limiter'
