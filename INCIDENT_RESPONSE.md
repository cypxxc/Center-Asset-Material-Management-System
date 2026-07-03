# Incident Response — CAMMS / Registry-S

## Severity Levels

| Level | Description | Response |
|-------|-------------|----------|
| P1 | Service down, data loss risk | Immediate, all hands |
| P2 | Degraded performance, partial outage | 30 min response |
| P3 | Non-critical defect | Next business day |

## First 15 Minutes

1. **Confirm impact** — `/api/health/readiness`, user reports
2. **Capture trace IDs** — from response headers `x-request-id` or logs
3. **Check dependencies** — Supabase status, env vars (`verify-env`)
4. **Communicate** — status channel with severity and ETA
5. **Mitigate** — rollback deploy, disable feature flag, scale instance

## Investigation Playbook

### Database down (readiness.database = down)

1. Verify Supabase project status
2. Check RLS/migration drift
3. Review recent migrations: `tsx scripts/apply-migrations.ts`
4. See `RECOVERY.md`

### Storage down (readiness.storage = down)

1. Verify `item-images` bucket exists
2. Check Supabase storage policies
3. Image uploads fail gracefully — core CRUD may still work

### High error rate

1. Query logs: `status:failure` last 15 min, group by `feature` + `operation`
2. Check deploy correlation (build id in `/api/health/status`)
3. Roll back if correlated with release

### Login failures spike

1. Check `login.failure` metric
2. Rate limit may trigger — review `config.limits.loginRateLimit`
3. Verify `SUPABASE_SERVICE_ROLE_KEY` for name/UUID lookup

## Escalation

- **App team:** schema, actions, RLS
- **Platform:** hosting, env, probes
- **Supabase:** provider outage

## Post-Incident

- Write RCA within 48 hours
- Update runbooks
- Adjust SLO/error budget if needed

See `RUNBOOK.md`, `RECOVERY.md`, `SECURITY.md`.
