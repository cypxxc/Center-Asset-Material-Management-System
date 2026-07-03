# Sprint 7 — Technical Debt Report

## Resolved

- Duplicate dead audit logger (`lib/logging/audit.ts`) removed
- Inconsistent trace IDs across logs → `withTraceContext()`
- Client-side raw `console.error` in app components
- Magic numbers scattered in rate limits → `lib/config.ts`
- Single monolithic health check → split probes
- Auth/admin actions without observability hooks

## Remaining Operational Improvements

| Item | Priority | Effort |
|------|----------|--------|
| Roll beginActionTrace to all admin actions (SQL, import/export) | Medium | 1–2 d |
| External metrics exporter (Prometheus/OpenMetrics) | High | 2–3 d |
| Redis/Upstash rate limiter | High | 1–2 d |
| AbortSignal on admin SQL + long exports | Medium | 1 d |
| OpenTelemetry trace export | Low | 3–5 d |
| Email redaction in logs — confirm product requirement | Low | 0.5 d |
| Cache hit ratio instrumentation | Low | 1 d |
| E2E performance regression in CI | Medium | 2 d |

## Future Roadmap

### Sprint 8 (suggested)

- Prometheus `/api/metrics` endpoint
- Distributed tracing export
- Complete action instrumentation coverage audit

### Sprint 9 (suggested)

- Chaos testing (DB failover simulation)
- Automated error budget tracking
- Synthetic monitoring in production

## Backward Compatibility

- `/api/health` unchanged response shape
- No schema migrations
- No route or permission changes
- No UI workflow changes
