# Performance Baseline — CAMMS / Registry-S

Baseline captured Sprint 7 (observability instrumentation). Re-measure after major releases.

## Instrumented Operations

| Feature | Action | Metric |
|---------|--------|--------|
| items | createItem | `server_action.duration`, `items.created` |
| items | softDeleteItem | `server_action.duration`, `items.deleted` |
| items | importItemsBulk | `server_action.duration`, `csv.import` |
| auth | login | `server_action.duration`, `login.success/failure` |
| auth | updatePersonalProfile | `server_action.duration` |
| admin | createAuthUser | `server_action.duration` |
| settings | * mutations | `server_action.duration` (Sprint 5) |
| queries | any | `query.latency` via `measureQuery()` |

## Expected Latency (local dev, warm)

| Operation | Typical | Slow threshold |
|-----------|---------|----------------|
| createItem | 200–600 ms | 2000 ms |
| softDeleteItem | 150–400 ms | 2000 ms |
| login | 300–900 ms | 2000 ms |
| importItemsBulk (50 rows) | 1–4 s | 8 s |
| readiness check | 50–300 ms | 1000 ms |

## Bottleneck Notes

1. **Supabase round-trips** — dominant factor for CRUD actions
2. **Image upload** — storage upload + retry adds 200–800 ms
3. **CSV import** — RPC batch; monitor `csv.import` row counts
4. **Admin UUID lookup login** — extra auth.admin API call

## Cache

- React `cache()` on queries — no hit-ratio metric yet (future: wrap `measureQuery`)
- Sidebar layout revalidation on item mutations — intentional staleness tradeoff

## Measurement Commands

```bash
npm test                    # unit tests include performance helpers
curl localhost:3000/api/health/status   # uptime, memory, metrics aggregates
```

## Tuning Knobs (`lib/config.ts`)

- `observability.slowActionThresholdMs` — 2000
- `observability.slowQueryThresholdMs` — 1000
- `limits.supabaseQueryTimeoutMs` — 15000
- `retry.maxAttempts` — 3

Update this document after load testing in staging/production.
