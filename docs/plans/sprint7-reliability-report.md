# Sprint 7 — Reliability Report

## Retries

**Module:** `lib/retry.ts`

- Exponential backoff with jitter
- Default: 3 attempts, 200 ms base, 5 s max delay
- Transient detection: network errors, 502/503/429, Supabase codes
- Wrappers: `retrySupabase()`, `retryStorage()`

**Applied to:**

- Auth: login lookups, signIn, password update
- Admin: createAuthUser
- Items: storage upload/remove

## Timeouts

Centralized in `lib/config.ts`:

| Setting | Value |
|---------|-------|
| adminSqlTimeoutMs | 30,000 |
| supabaseQueryTimeoutMs | 15,000 |
| exportTimeoutMs | 120,000 |

*Note: AbortSignal wiring for long operations is config-ready; enforce in future pass on admin SQL runner.*

## Error Handling

- Typed errors: Validation, Authorization, NotFound, Conflict, RateLimit, Unexpected
- `handleActionError()` maps operational errors to safe Thai messages
- NEXT_REDIRECT preserved (not swallowed)

## Failure Recovery

- Storage upload failures: retry then user-facing error; orphaned images cleaned on create failure
- createAuthUser: auth user rollback on profile upsert failure (existing)
- Unhandled rejections: logged at process level via instrumentation.ts

## Rate Limiting

- Login: 10/min (new)
- Items/settings: existing in-memory limiter
- **Limitation:** single-instance memory store — document for multi-instance deploy

## Recommendations

1. Add Redis-backed rate limiter for production cluster
2. Wire AbortSignal to admin SQL and export paths
3. Extend retry to remaining admin mutations
