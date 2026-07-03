import { config } from '@/lib/config'

export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  jitterFactor?: number
  /** Return true if the error is transient and should be retried. */
  isRetryable?: (error: unknown, attempt: number) => boolean
  signal?: AbortSignal
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

const DEFAULT_IS_RETRYABLE = (error: unknown): boolean => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('econnrefused') ||
      msg.includes('network') ||
      msg.includes('fetch failed') ||
      msg.includes('timeout') ||
      msg.includes('503') ||
      msg.includes('502') ||
      msg.includes('429')
    ) {
      return true
    }
  }

  // Supabase transient error codes
  const code = (error as { code?: string })?.code
  if (code === 'PGRST000' || code === '57014' || code === '08006' || code === '08001') {
    return true
  }

  return false
}

function computeDelay(attempt: number, opts: Required<Pick<RetryOptions, 'baseDelayMs' | 'maxDelayMs' | 'jitterFactor'>>): number {
  const exponential = opts.baseDelayMs * Math.pow(2, attempt - 1)
  const capped = Math.min(exponential, opts.maxDelayMs)
  const jitter = capped * opts.jitterFactor * (Math.random() * 2 - 1)
  return Math.max(0, Math.round(capped + jitter))
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

/**
 * Retry an async operation with exponential backoff and jitter.
 * Only retries when isRetryable returns true (defaults to transient network/DB errors).
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? config.retry.maxAttempts
  const baseDelayMs = options.baseDelayMs ?? config.retry.baseDelayMs
  const maxDelayMs = options.maxDelayMs ?? config.retry.maxDelayMs
  const jitterFactor = options.jitterFactor ?? config.retry.jitterFactor
  const isRetryable = options.isRetryable ?? DEFAULT_IS_RETRYABLE

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt >= maxAttempts || !isRetryable(error, attempt)) {
        throw error
      }

      const delayMs = computeDelay(attempt, { baseDelayMs, maxDelayMs, jitterFactor })
      options.onRetry?.(error, attempt, delayMs)
      await sleep(delayMs, options.signal)
    }
  }

  throw lastError
}

/** Retry wrapper tuned for Supabase client calls. */
export async function retrySupabase<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return retry(fn, { signal })
}

/** Retry wrapper tuned for storage uploads/downloads. */
export async function retryStorage<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return retry(fn, {
    maxAttempts: 4,
    signal,
    isRetryable: (error) => DEFAULT_IS_RETRYABLE(error),
  })
}
