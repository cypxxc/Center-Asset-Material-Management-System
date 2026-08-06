import { headers } from 'next/headers'
import { getCurrentProfile } from '@/features/auth/queries'

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export interface RateLimiter {
  limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult>
}

interface RateLimitBucket {
  timestamps: number[]
}

export class MemoryRateLimiter implements RateLimiter {
  private cache = new Map<string, RateLimitBucket>()

  constructor() {
    // Automatically prune old entries from memory every 1 minute
    if (typeof global !== 'undefined') {
      const interval = setInterval(() => {
        const now = Date.now()
        for (const [key, bucket] of this.cache.entries()) {
          // Keep timestamps in the last 10 minutes to be safe, or just filter
          bucket.timestamps = bucket.timestamps.filter((t) => now - t < 600000)
          if (bucket.timestamps.length === 0) {
            this.cache.delete(key)
          }
        }
      }, 60000)

      // Unref the timer so it doesn't prevent Node.js test runner processes from exiting
      if (typeof interval.unref === 'function') {
        interval.unref()
      }
    }
  }

  async limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    let bucket = this.cache.get(key)
    if (!bucket) {
      bucket = { timestamps: [] }
      this.cache.set(key, bucket)
    }

    // Filter out timestamps older than the sliding window
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs)

    if (bucket.timestamps.length >= limit) {
      const oldest = bucket.timestamps[0]
      return {
        success: false,
        limit,
        remaining: 0,
        reset: oldest + windowMs,
      }
    }

    bucket.timestamps.push(now)
    return {
      success: true,
      limit,
      remaining: limit - bucket.timestamps.length,
      reset: now + windowMs,
    }
  }
}

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
