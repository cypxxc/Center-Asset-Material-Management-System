# Sprint 7 — Observability Report

**Project:** Registry-S (CAMMS)  
**Date:** 2026-07-03

## Coverage

| Area | Before Sprint 7 | After Sprint 7 |
|------|-----------------|----------------|
| Server actions with tracing | items (partial), settings (full) | + auth (full), admin createAuthUser, items (trace context on key ops) |
| Trace headers | x-request-id only | x-request-id, x-correlation-id, x-trace-id |
| Typed errors | Generic handleActionError | lib/errors/* + safe mapping |
| Metrics | None | lib/metrics.ts pluggable |
| Health | Single /api/health | + readiness, liveness, status |
| Config centralization | Scattered magic numbers | lib/config.ts |
| Feature flags | None | lib/feature-flags.ts |
| Client console.error | 3 files | Removed |

## Metrics Collected

- `server_action.success` / `server_action.failure` / `server_action.duration`
- `items.created`, `items.deleted`, `csv.import`
- `login.success`, `login.failure`
- `query.latency` (via measureQuery)
- Slow counters: `{metric}.slow`

## Tracing

- **Middleware:** `proxy.ts` → `ensureTraceHeaders()`
- **Actions:** `beginActionTrace()` / `traceAction()`
- **Logger:** `withTraceContext()` enriches all structured logs
- **Audit:** correlationId + traceId in audit_logs JSONB

## Logging

- JSON structured output with severity, hostname, duration
- Email/phone redaction added
- Boot + unhandledRejection in instrumentation.ts
- Dead code removed: lib/logging/audit.ts

## Health Checks

| Endpoint | Checks |
|----------|--------|
| /api/health/readiness | database, storage, environment |
| /api/health/liveness | process runtime |
| /api/health/status | version, build, memory, node, metrics |
| /api/health | Legacy aggregate (backward compatible) |

## Gaps / Future

- Full traceAction rollout on all admin/db-panel actions
- External metrics exporter (Prometheus)
- Distributed rate limiter (Redis)
- Query-level cache hit ratio
- OpenTelemetry SDK integration
