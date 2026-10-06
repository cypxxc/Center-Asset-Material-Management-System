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

interface MetricAggregate {
  count: number
  sum: number
  min: number
  max: number
}

/** In-memory exporter — pluggable; swap for Prometheus/Datadog without changing call sites.
 *  Maintains O(1) aggregates and a bounded ring of raw snapshots (default 500) for debugging.
 */
class MemoryMetricsExporter implements MetricsExporter {
  private readonly maxSnapshots: number
  /** Circular buffer for raw snapshots (debug only). */
  private ring: (MetricSnapshot | undefined)[]
  private ringHead = 0
  private ringCount = 0
  /** Pre-computed aggregates — O(1) read, no snapshot scan needed. */
  private aggregates: Record<string, MetricAggregate> = {}

  constructor(maxSnapshots = 500) {
    this.maxSnapshots = maxSnapshots
    this.ring = new Array(maxSnapshots)
  }

  record(snapshot: MetricSnapshot): void {
    // Write into circular buffer (overwrites oldest when full)
    this.ring[this.ringHead] = snapshot
    this.ringHead = (this.ringHead + 1) % this.maxSnapshots
    if (this.ringCount < this.maxSnapshots) this.ringCount++

    // Update running aggregates — O(1)
    const key = `${snapshot.type}:${snapshot.name}`
    const agg = this.aggregates[key]
    if (!agg) {
      this.aggregates[key] = { count: 1, sum: snapshot.value, min: snapshot.value, max: snapshot.value }
    } else {
      agg.count++
      agg.sum += snapshot.value
      if (snapshot.value < agg.min) agg.min = snapshot.value
      if (snapshot.value > agg.max) agg.max = snapshot.value
    }
  }

  getSnapshots(): MetricSnapshot[] {
    if (this.ringCount < this.maxSnapshots) {
      return this.ring.slice(0, this.ringCount).filter((s): s is MetricSnapshot => Boolean(s))
    }
    // Reconstruct chronological order from circular buffer
    return [
      ...this.ring.slice(this.ringHead),
      ...this.ring.slice(0, this.ringHead),
    ].filter((s): s is MetricSnapshot => Boolean(s))
  }

  getAggregates(): Record<string, MetricAggregate> {
    return { ...this.aggregates }
  }

  reset(): void {
    this.ring = new Array(this.maxSnapshots)
    this.ringHead = 0
    this.ringCount = 0
    this.aggregates = {}
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
