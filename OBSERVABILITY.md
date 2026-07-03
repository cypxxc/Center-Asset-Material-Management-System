# CAMMS Observability Guide

## Overview

Registry-S (CAMMS) uses structured JSON logging, distributed request tracing, pluggable metrics, and split health endpoints for production operations.

## Request Tracing

Every HTTP request receives three IDs via `proxy.ts`:

| Header | Purpose |
|--------|---------|
| `x-request-id` | Unique per HTTP request |
| `x-correlation-id` | Business flow correlation (defaults to request-id) |
| `x-trace-id` | Distributed trace span |

### Server Actions

Use `beginActionTrace()` or `traceAction()` from `@/lib/tracing`:

```typescript
const trace = await beginActionTrace({ feature: 'items', action: 'createItem', userId })
// ... work ...
trace.complete('success')
```

Logs automatically include: `requestId`, `correlationId`, `traceId`, `userId`, `feature`, `action`, `latency`, `status`.

### Audit Logs

`writeAuditLog()` persists `requestId`, `correlationId`, and `traceId` in JSONB metadata.

## Logging

- **Format:** JSON lines prefixed `[CAMMS-INFO|WARN|ERROR|DEBUG|AUDIT]`
- **Module:** `lib/logging/`
- **Redaction:** passwords, tokens, keys, email, phone, JWT, Supabase keys
- **Fields:** `timestamp`, `level`, `severity`, `hostname`, `environment`, `duration`, trace IDs

Set `LOG_LEVEL=debug` for debug output in production.

## Metrics

- **Module:** `lib/metrics.ts`
- **Types:** counters, histograms, timers
- **Pluggable:** `setMetricsExporter()` for Prometheus/Datadog adapters
- **Disable:** `METRICS_ENABLED=false` or `FEATURE_METRICS_ENABLED=false`

Domain counters: `items.created`, `items.deleted`, `login.success`, `login.failure`, `csv.import`.

View in-process aggregates: `GET /api/health/status`.

## Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/health` | Legacy aggregate (backward compatible) |
| `/api/health/readiness` | DB + storage + env |
| `/api/health/liveness` | Process alive |
| `/api/health/status` | Version, memory, node, metrics snapshot |

## Error Classification

Typed errors in `lib/errors/` — use `ValidationError`, `AuthorizationError`, etc. `handleActionError()` maps them to safe Thai client messages.

## Configuration

Central config: `lib/config.ts` — limits, timeouts, retry policy, observability thresholds.

## Feature Flags

`lib/feature-flags.ts` — env-based flags (`FEATURE_*`), percentage rollout ready.

See also: `SRE_GUIDE.md`, `MONITORING.md`, `INCIDENT_RESPONSE.md`.
