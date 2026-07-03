import { RateLimiter, RateLimitResult } from './types'

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
