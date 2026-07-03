# SRE Guide — CAMMS / Registry-S

## On-call Responsibilities

1. Monitor readiness/liveness probes
2. Triage structured logs by `requestId` / `correlationId`
3. Execute runbooks in `RUNBOOK.md` and `INCIDENT_RESPONSE.md`
4. Escalate when error budget burn exceeds thresholds

## Architecture for Reliability

```
Client → proxy.ts (trace headers) → Server Actions (beginActionTrace)
                                              ↓
                                    Supabase (retrySupabase/retryStorage)
                                              ↓
                                    audit_logs + structured logs + metrics
```

## Key Modules

| Module | Role |
|--------|------|
| `lib/tracing/` | Request context, action instrumentation |
| `lib/metrics.ts` | Counters, histograms, timers |
| `lib/retry.ts` | Exponential backoff + jitter |
| `lib/errors/` | Typed operational errors |
| `lib/config.ts` | Centralized limits and timeouts |
| `lib/health/checks.ts` | Readiness/liveness logic |
| `instrumentation.ts` | Boot logging, unhandled rejection handler |

## Deployment Checklist

- [ ] `npm run verify-env` passes
- [ ] `/api/health/readiness` returns 200
- [ ] Supabase migrations applied
- [ ] `LOG_LEVEL` set appropriately
- [ ] Probe liveness + readiness configured in load balancer
- [ ] Alerts wired per `docs/monitoring/operational-metrics.md`

## Capacity Planning

- In-memory rate limiter: single-instance only; plan Redis/Upstash for horizontal scale
- Memory metrics at `/api/health/status` — alert at 85% heap
- CSV import: rate limited to 5 per 5 min per user

## Change Management

Sprint 7 rule: **no new business features** in observability sprints. Instrumentation-only changes should not alter RLS, routes, or UI workflows.

## Post-Incident

1. Identify trace IDs from logs
2. Document timeline in incident channel
3. Update `INCIDENT_RESPONSE.md` if runbook gap found
4. Track error budget consumption
