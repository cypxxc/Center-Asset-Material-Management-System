import { headers } from 'next/headers'
import { getCurrentProfile } from '@/features/auth/queries'
import { logSecurityEvent } from '@/lib/security-logger'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { PostgresRateLimiter } from './postgres-rate-limit'
import { getTrustedClientIp } from './request-ip'

export type RateLimitTier = 'auth' | 'mutation' | 'export' | 'read'

export const RATE_LIMIT_TIERS: Record<RateLimitTier, { limit: number; windowMs: number }> = {
  auth: { limit: 10, windowMs: 60000 },
  mutation: { limit: 30, windowMs: 60000 },
  export: { limit: 20, windowMs: 60000 },
  read: { limit: 120, windowMs: 60000 },
}

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
  private maxKeys = 10000

  constructor(maxKeys = 10000) {
    this.maxKeys = maxKeys
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

    // Evict oldest entries if capacity exceeded
    if (this.cache.size >= this.maxKeys && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) this.cache.delete(firstKey)
    }

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
    globalRateLimiter = new PostgresRateLimiter((name, args) =>
      createServiceRoleClient().rpc(name, args).abortSignal(AbortSignal.timeout(5000)))
  }
  return globalRateLimiter
}

export interface CheckRateLimitResult {
  success: boolean
  error?: string
}

export async function checkRateLimit(
  actionName: string,
  tierOrLimit?: RateLimitTier | number,
  customWindowMs?: number,
  // Internal server callers only: pass the profile already returned by their
  // authorization guard in this action. Never populate this from action input.
  verifiedProfile?: { id: string; is_active: boolean }
): Promise<CheckRateLimitResult> {
  let limitValue = 60
  let windowMs = 60000

  if (typeof tierOrLimit === 'string' && tierOrLimit in RATE_LIMIT_TIERS) {
    limitValue = RATE_LIMIT_TIERS[tierOrLimit].limit
    windowMs = customWindowMs ?? RATE_LIMIT_TIERS[tierOrLimit].windowMs
  } else if (typeof tierOrLimit === 'number') {
    limitValue = tierOrLimit
    windowMs = customWindowMs ?? 60000
  } else if (customWindowMs !== undefined) {
    windowMs = customWindowMs
  }

  try {
    const headersList = await headers()
    const ip = getTrustedClientIp(headersList)

    let userId = 'anonymous'
    if (actionName !== 'login') {
      if (verifiedProfile && !verifiedProfile.is_active) return { success: false, error: 'กรุณาเข้าสู่ระบบด้วยบัญชีที่เปิดใช้งานก่อนทำรายการ' }
      const profile = verifiedProfile ?? await getCurrentProfile()
      if (!profile?.id) return { success: false, error: 'กรุณาเข้าสู่ระบบด้วยบัญชีที่เปิดใช้งานก่อนทำรายการ' }
      userId = profile.id
    }

    // A user cannot rotate IPs to reset a mutation limit. Login is always IP-bound.
    const key = JSON.stringify([actionName, userId === 'anonymous' ? `ip:${ip}` : `user:${userId}`])
    const limiter = getRateLimiter()
    const result = await limiter.limit(key, limitValue, windowMs)

    if (!result.success) {
      logSecurityEvent({
        severity: tierOrLimit === 'auth' ? 'HIGH' : 'MEDIUM',
        eventType: 'RATE_LIMIT_EXCEEDED',
        threatVector: `Rate limit exceeded on action '${actionName}'`,
        impactAnalysis: `Throttled requests from actor (limit: ${limitValue}, window: ${windowMs}ms)`,
        automatedActionTaken: 'Blocked request and returned rate limit error message',
        recommendedFollowUp: `Monitor IP ${ip} and user ${userId} for suspicious high-frequency activity`,
        actor: {
          userId,
          ip,
        },
        metadata: {
          actionName,
          tier: typeof tierOrLimit === 'string' ? tierOrLimit : 'custom',
          limit: limitValue,
          windowMs,
          resetAt: new Date(result.reset).toISOString(),
        },
      })

      const secondsLeft = Math.ceil((result.reset - Date.now()) / 1000)
      return {
        success: false,
        error: `คุณส่งคำขอมากเกินไป กรุณารออีก ${Math.max(1, secondsLeft)} วินาทีก่อนลองใหม่อีกครั้ง`,
      }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'ระบบตรวจสอบจำนวนคำขอไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' }
  }
}
