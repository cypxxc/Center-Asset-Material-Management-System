import { config } from '@/lib/config'
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
  fn: () => Promise<T>,
  options?: { metricName?: string; labels?: Record<string, string> },
): Promise<{ result: T; durationMs: number }> {
  const timer = startTimer()
  const result = await fn()
  const durationMs = timer.stop()

  if (options?.metricName) {
    metrics.timer(options.metricName, durationMs, options.labels)
    if (durationMs >= config.observability.slowQueryThresholdMs) {
      metrics.counter(`${options.metricName}.slow`, 1, options.labels)
    }
  }

  return { result, durationMs }
}

export function measureExecutionSync<T>(fn: () => T): { result: T; durationMs: number } {
  const timer = startTimer()
  const result = fn()
  const durationMs = timer.stop()
  return { result, durationMs }
}

/** Measure a Supabase/query call and record query.latency metric. */
export async function measureQuery<T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  return measureExecution(fn, { metricName: 'query.latency', labels: { operation } })
}
