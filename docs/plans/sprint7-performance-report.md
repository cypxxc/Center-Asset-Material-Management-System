# Sprint 7 — Performance Instrumentation Report

## Measured Endpoints / Actions

| Path / Action | Instrumentation |
|---------------|-----------------|
| POST server actions (auth) | beginActionTrace + metrics |
| createItem, softDeleteItem, importItemsBulk | latency logs + domain metrics + trace context |
| createAuthUser | beginActionTrace |
| settings mutations | startTimer + latency (Sprint 5) |
| queries (future) | measureQuery() available |

## Latency Recording

- `startTimer()` — hrtime precision
- `measureExecution({ metricName })` — auto histogram
- `beginActionTrace().complete()` — logs + server_action.duration histogram
- Slow threshold warnings at 2000 ms (actions), 1000 ms (queries)

## Bottlenecks Identified

1. Supabase network latency (dominant)
2. Auth login by UUID/name — extra admin API round-trip
3. CSV import — batch RPC
4. Image upload — storage with retry adds latency under failure

## Metrics Collected

See `/api/health/status` for in-process aggregates.

Domain counters wired for high-value mutations only (by design — avoid cardinality explosion).

## Next Steps

- Add export duration metric in reports action
- Profile cold-start impact on serverless deploys
- Load test staging to replace dev baselines in PERFORMANCE_BASELINE.md
