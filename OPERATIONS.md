# Operations Guide (OPERATIONS.md)

Registry-S (CAMMS) is a Next.js 16 + Supabase internal application built for enterprise inventory tracking.

---

## 1. System Architecture & Context

```
   [ Client Browser ]
           |
     HTTP/HTTPS Requests (propagating x-request-id)
           v
   [ Edge Proxy Middleware ] (Validates sessions, applies CSP & Security Headers)
           |
   [ Next.js Server App ]
     |                  \
     v                   v
[ Supabase Auth ]   [ Supabase Postgres ] (RLS enforced)
                         |
                    [ Supabase Storage ] (item-images)
```

---

## 2. Environment Variables & Combinations

The application requires specific configurations in `.env.local` / `.env.production`:

- `NEXT_PUBLIC_SUPABASE_URL`: Full URL of the Supabase API endpoint (e.g. `https://your-project.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Client-safe key for RLS-enforced database queries.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key bypasses RLS. Restricted to backend admin tasks. **Never expose to the client.**

### CI vs Production Validation
- **CI Build:** Mock fallback values (e.g. `https://example.supabase.co`) are permitted to allow compilation and static exports without requiring secret pings.
- **Production Deploy:** Rejects placeholders. `scripts/verify-env.ts` will raise exit code `1` if mock credentials are set during a production boot.

---

## 3. Observability & Central Logging

Central structured logging outputs raw JSON formats to standard console streams (`console.info`, `console.warn`, `console.error`).

### Log Structure
Each JSON log line includes:
- `timestamp` (ISO-8601)
- `level` (INFO, WARN, ERROR, AUDIT, DEBUG)
- `environment` (production, development)
- `operation` (e.g., `createItem`)
- `feature` (e.g., `items`)
- `userId` (Authenticated profile ID if present)
- `requestId` (Correlation trace ID copied from `x-request-id`)
- `latency` (Computed execution duration in milliseconds)

### Logs PII Sanitization
The formatting serializer automatically redacts:
- Credentials, tokens, keys, cookies, sessions, passwords.
- Inline JWT headers (`eyJ...`) and Supabase service key structures.

---

## 4. Health Check Monitoring

Endpoint `/api/health` checks:
- **Database Status:** Queries the profile table to verify Postgres connectivity.
- **Storage Status:** Lists files in the `item-images` bucket to verify storage health.

### Response Signals
- **Healthy:** Returns HTTP status `200` with JSON `{"status": "healthy", ...}`.
- **Unhealthy:** Returns HTTP status `503` with JSON `{"status": "unhealthy", ...}`.
- *Note: Exposes no sensitive internal keys or connection strings.*
