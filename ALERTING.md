# Alerting — CAMMS / Registry-S

## Alert Routing

| Severity | Channel | Response SLA |
|----------|---------|--------------|
| P1 | Pager + Slack #incidents | 15 min |
| P2 | Slack #ops-alerts | 30 min |
| P3 | Slack #ops-alerts (daily digest) | 24 h |

## Alert Definitions

### P1 — Critical

**ReadinessDown**
- Trigger: `GET /api/health/readiness` != 200 for 2 consecutive minutes
- Action: Page on-call, check Supabase, review deploys

**StorageDown**
- Trigger: readiness body `checks.storage.status == "down"` for 2 min
- Action: Verify bucket and policies

**HighErrorRate**
- Trigger: > 5% `server_action.failure` over 5 min window
- Action: Query logs by feature, consider rollback

### P2 — Warning

**SlowServerActions**
- Trigger: p95 `server_action.duration` > 2000 ms for 10 min
- Action: Review slow query logs, check Supabase performance

**LoginFailureSpike**
- Trigger: > 20 `login.failure` in 5 min
- Action: Check auth service, possible brute force (rate limit active)

**MemoryPressure**
- Trigger: `memory.heapUsed / memory.heapTotal > 0.85` for 15 min
- Action: Restart instance, investigate leak

**UnhandledRejection**
- Trigger: `[CAMMS-ERROR]` with `operation:unhandledRejection`
- Action: Fix code path, deploy patch

### P3 — Informational

**ErrorBudgetBurn**
- Trigger: 50% monthly error budget consumed in 7 days
- Action: Schedule reliability review

## Silencing

- Maintenance window: silence readiness alerts only if liveness OK and downtime communicated
- Max silence: 4 hours without re-approval

## Testing Alerts

1. Stop Supabase temporarily in staging → readiness alert fires
2. Force `login.failure` in load test → spike alert fires
3. Verify alert → runbook link in notification

See `docs/monitoring/operational-metrics.md` for threshold details.
