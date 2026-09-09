import { createHash } from 'node:crypto'
import type { RateLimiter, RateLimitResult } from './rate-limit'

type RateLimitRpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>

/** Every instance delegates to the same database; no process-local counters. */
export class PostgresRateLimiter implements RateLimiter {
  constructor(private readonly rpc: RateLimitRpc) {}

  async limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    if (!key || !Number.isSafeInteger(limit) || limit < 1 || limit > 10000 || !Number.isSafeInteger(windowMs) || windowMs < 1000 || windowMs > 86400000) {
      throw new Error('Invalid rate-limit parameters')
    }
    const bucketKey = createHash('sha256').update(JSON.stringify([key, limit, windowMs])).digest('hex')
    const { data, error } = await this.rpc('consume_rate_limit', { bucket_key: bucketKey, request_limit: limit, window_ms: windowMs })
    if (error || !data || typeof data !== 'object') throw new Error('Rate-limit storage unavailable')
    const result = data as Record<string, unknown>
    if (typeof result.success !== 'boolean' || !Number.isSafeInteger(result.remaining) || (result.remaining as number) < 0 || (result.remaining as number) >= limit || !Number.isSafeInteger(result.reset) || (result.reset as number) <= 0 || (!result.success && result.remaining !== 0)) {
      throw new Error('Invalid rate-limit storage response')
    }
    return { success: result.success, remaining: result.remaining as number, reset: result.reset as number, limit }
  }
}
