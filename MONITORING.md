# Monitoring — CAMMS / Registry-S

## Probe Configuration

### Kubernetes / Docker

```yaml
livenessProbe:
  httpGet:
    path: /api/health/liveness
    port: 3000
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health/readiness
    port: 3000
  periodSeconds: 30
  failureThreshold: 2
```

### Uptime checks (external)

- Poll `/api/health/readiness` every 60 s from 2+ regions
- Alert on 2 consecutive failures

## Log Aggregation

Ship stdout/stderr to your log platform. Filter by prefix:

- `[CAMMS-INFO]`, `[CAMMS-WARN]`, `[CAMMS-ERROR]`, `[CAMMS-AUDIT]`, `[CAMMS-BOOT]`

Query examples:

```
feature:items AND status:failure
operation:login AND status:failure
latency:>2000
```

## Metrics Export

Default: in-memory (`metrics._getMemoryExporter()`). For production:

1. Implement `MetricsExporter` interface
2. Call `setMetricsExporter(yourExporter)` in `instrumentation.ts`
3. Scrape or push from your collector

## Dashboards

See `docs/monitoring/operational-metrics.md` for SLI/SLO panels.

## Synthetic Checks

- Login flow (Playwright `tests/e2e/critical-journey.test.ts`)
- Health endpoints in CI (`tests/unit/health.test.ts`)

## Related Docs

- `OBSERVABILITY.md` — tracing and logging
- `ALERTING.md` — alert routing
- `PERFORMANCE_BASELINE.md` — latency baselines
