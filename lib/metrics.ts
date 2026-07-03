import { config } from '@/lib/config'

export type MetricLabels = Record<string, string | number | boolean>

export interface MetricSnapshot {
  name: string
  type: 'counter' | 'histogram' | 'timer'
  value: number
  labels: MetricLabels
  timestamp: string
}

export interface MetricsExporter {
  record(snapshot: MetricSnapshot): void
  flush?(): Promise<void>
}

/** In-memory exporter — pluggable; swap for Prometheus/Datadog without changing call sites. */
class MemoryMetricsExporter implements MetricsExporter {
  private snapshots: MetricSnapshot[] = []
  private readonly maxSnapshots = 10_000

  record(snapshot: MetricSnapshot): void {
    this.snapshots.push(snapshot)
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift()
    }
  }

  getSnapshots(): MetricSnapshot[] {
    return [...this.snapshots]
  }

  getAggregates(): Record<string, { count: number; sum: number; min: number; max: number }> {
    const agg: Record<string, { count: number; sum: number; min: number; max: number }> = {}
    for (const s of this.snapshots) {
      const key = `${s.type}:${s.name}`
      if (!agg[key]) {
        agg[key] = { count: 0, sum: 0, min: Infinity, max: -Infinity }
      }
      agg[key].count += 1
      agg[key].sum += s.value
      agg[key].min = Math.min(agg[key].min, s.value)
      agg[key].max = Math.max(agg[key].max, s.value)
    }
    return agg
  }

  reset(): void {
    this.snapshots = []
  }
}

const defaultExporter = new MemoryMetricsExporter()
let activeExporter: MetricsExporter = defaultExporter

export function setMetricsExporter(exporter: MetricsExporter): void {
  activeExporter = exporter
}

export function resetMetricsExporter(): void {
  activeExporter = defaultExporter
  defaultExporter.reset()
}

function emit(type: MetricSnapshot['type'], name: string, value: number, labels: MetricLabels = {}): void {
  if (!config.observability.metricsEnabled) return
  activeExporter.record({
    name,
    type,
    value,
    labels,
    timestamp: new Date().toISOString(),
  })
}

export const metrics = {
  counter(name: string, value = 1, labels?: MetricLabels): void {
    emit('counter', name, value, labels)
  },

  histogram(name: string, value: number, labels?: MetricLabels): void {
    emit('histogram', name, value, labels)
  },

  timer(name: string, durationMs: number, labels?: MetricLabels): void {
    emit('timer', name, durationMs, labels)
  },

  /** Convenience wrappers for domain events */
  itemCreated(): void {
    this.counter('items.created', 1)
  },
  itemDeleted(): void {
    this.counter('items.deleted', 1)
  },
  loginSuccess(): void {
    this.counter('login.success', 1)
  },
  loginFailure(): void {
    this.counter('login.failure', 1)
  },
  csvImport(rows: number): void {
    this.counter('csv.import', 1, { rows })
  },

  /** Test / diagnostics access */
  _getMemoryExporter(): MemoryMetricsExporter {
    return defaultExporter
  },
}

export type Metrics = typeof metrics
