# Operational Metrics — CAMMS / Registry-S

## Service Level Indicators (SLI)

| SLI | Measurement | Source |
|-----|-------------|--------|
| Availability | Successful readiness checks / total checks | `/api/health/readiness` |
| Latency (p95) | Server action duration ms | `server_action.duration` histogram |
| Error rate | `server_action.failure` / total actions | Structured logs + metrics |
| Login success rate | `login.success` / (`login.success` + `login.failure`) | `lib/metrics.ts` |
| DB dependency health | Readiness `checks.database.status` | Health endpoint |

## Service Level Objectives (SLO)

| Objective | Target | Window |
|-----------|--------|--------|
| Availability | 99.5% | 30 days |
| API readiness | 99.9% | 30 days |
| Server action p95 latency | < 2000 ms | 7 days |
| Login success (valid credentials) | > 99% | 7 days |
| Error budget (5xx/unhandled) | < 0.5% requests | 30 days |

## Error Budget

- **Monthly budget:** 0.5% of requests may fail (≈ 3.6 hours downtime equivalent at steady traffic).
- **Burn alerts:** Page when 50% of monthly budget consumed in 7 days.
- **Freeze:** Stop non-ops deployments when budget exhausted until post-incident review.

## Latency Targets

| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| Server actions (CRUD) | 300 ms | 1500 ms | 3000 ms |
| CSV import (100 rows) | 2 s | 8 s | 15 s |
| Export | 1 s | 5 s | 10 s |
| Login | 200 ms | 800 ms | 1500 ms |
| Health readiness | 100 ms | 500 ms | 1000 ms |

## Availability Targets

- **Liveness:** Process responds within 1 s — `/api/health/liveness`
- **Readiness:** DB + storage + env valid — `/api/health/readiness`
- **RTO:** 30 minutes (restore from backup per RUNBOOK.md)
- **RPO:** 24 hours (daily backup assumption)

## Alert Thresholds

| Alert | Condition | Severity |
|-------|-----------|----------|
| ReadinessDown | readiness != 200 for 2 min | P1 |
| HighErrorRate | server_action.failure > 5% / 5 min | P1 |
| SlowActions | p95 server_action.duration > 2000 ms / 10 min | P2 |
| LoginFailuresSpike | login.failure > 20 / 5 min | P2 |
| MemoryHigh | heapUsed > 85% heapTotal / 15 min | P2 |
| StorageDown | readiness checks.storage = down | P1 |
| UnhandledRejection | instrumentation hook fires | P2 |

## Dashboard Panels (recommended)

1. Request rate + error rate by feature
2. Server action latency heatmap (feature × action)
3. Login success/failure counters
4. Readiness check latency (db, storage, env)
5. Memory + uptime from `/api/health/status`
6. Top slow operations (`slow: true` in logs)
