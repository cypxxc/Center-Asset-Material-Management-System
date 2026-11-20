import { config } from '@/lib/config'
import { logger } from '@/lib/logging'
import { metrics } from '@/lib/metrics'

export interface Timer {
  stop(): number
}

export function startTimer(): Timer {
  const start = process.hrtime.bigint()
  return {
    stop(): number {
      const end = process.hrtime.bigint()
      return Number(end - start) / 1_000_000
    },
  }
}

export async function measureExecution<T>(
  fn: () => PromiseLike<T>,
  options?: { metricName?: string; labels?: Record<string, string> },
): Promise<{ result: T; durationMs: number }> {
  const timer = startTimer()
  const result = await fn()
  const durationMs = timer.stop()

  if (options?.metricName) {
    metrics.timer(options.metricName, durationMs, options.labels)
    if (durationMs >= config.observability.slowQueryThresholdMs) {
      metrics.counter(`${options.metricName}.slow`, 1, options.labels)
      logger.warn({
        operation: options.metricName,
        feature: 'performance',
        latency: durationMs,
        status: 'slow',
        details: options.labels,
      })
    }
  }

  return { result, durationMs }
}
