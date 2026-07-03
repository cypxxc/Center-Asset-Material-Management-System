# Sprint 7 — Operations Readiness Report

## SLI / SLO

Documented in `docs/monitoring/operational-metrics.md`:

- Availability 99.5% / 30d
- Readiness 99.9%
- p95 action latency < 2000 ms
- Error budget 0.5%

## Runbooks

| Document | Purpose |
|----------|---------|
| RUNBOOK.md | General operations |
| INCIDENT_RESPONSE.md | Incident triage |
| RECOVERY.md | Backup/restore |
| SRE_GUIDE.md | On-call guide |
| MONITORING.md | Probes and log shipping |
| ALERTING.md | Alert definitions |

## Alerts

Thresholds defined for readiness, error rate, latency, login spikes, memory — see ALERTING.md.

**Status:** Definitions complete; external wiring (PagerDuty/Datadog) is deployment-specific.

## Dashboards

Panel recommendations in `docs/monitoring/operational-metrics.md`.

In-app metrics snapshot: `GET /api/health/status`.

## Readiness Checklist

- [x] Split health probes
- [x] Structured logging with trace IDs
- [x] Central config validation
- [x] Retry on transient failures
- [x] Typed error taxonomy
- [x] Feature flags scaffold
- [ ] External metrics backend (operator task)
- [ ] Multi-instance rate limiting (operator task)

## Production Deploy

Configure load balancer:

- Liveness → `/api/health/liveness`
- Readiness → `/api/health/readiness`
- Do not route user traffic until readiness 200
