# Data Layer & Load Balancing Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 evidenced production risks found in the code review: (1) in-memory rate limiting that resets on process restart, (2) inline table-locking DELETE on every login, and (3) 52 MB body limit that blocks the Node.js event loop.

**Architecture:** Self-hosted Docker + Caddy + PostgreSQL (not serverless). The rate limiter will use PostgreSQL directly via a new `private_auth.rate_limits` table — no Redis dependency. Login-attempt cleanup moves to `after()` so the hot path is never blocked. The body limit is lowered to 10 MB and large uploads are routed via presigned URLs.

**Tech Stack:** Next.js 15, Drizzle ORM, `pg` (node-postgres), Node.js `node:test` runner, TypeScript.

## Global Constraints

- No new npm dependencies unless essential (PostgreSQL is already available).
- All tests use `node:test` + `assert` (no Jest / Vitest).
- All files begin with `import 'server-only'` where they touch the database.
- Follow existing patterns: `lib/postgres/` for DB helpers, `lib/` for pure-logic utilities.
- Commit after each task with a conventional commit message.
- Do not change `next.config.ts` `output: 'standalone'` or any Docker / Caddy config.

---

## Task 1: Move Login-Attempt Cleanup Out of the Hot Path

**Problem:** `consumeLoginAttempt` in `lib/postgres/login-throttle.ts` executes `DELETE FROM private_auth.login_attempts WHERE window_started_at < now() - interval '1 day'` inside every login transaction. Under concurrent logins this causes table-lock contention.

**Root cause confirmed:** Line 10 of `lib/postgres/login-throttle.ts`:
```ts
await tx.execute(sql`delete from private_auth.login_attempts where window_started_at < now() - interval '1 day'`)
```

**Fix:** Remove the inline DELETE and run cleanup asynchronously via `after()` (Next.js background task hook) after the login response is sent.

**Files:**
- Modify: `lib/postgres/login-throttle.ts`

**Interfaces:**
- Produces: `consumeLoginAttempt(identifier: string): Promise<boolean>` — same signature, same semantics, no table lock on main transaction.
- Produces: `pruneLoginAttempts(): Promise<void>` — new exported function, called from login action via `after()`.

- [ ] **Step 1: Write the failing test that shows cleanup is separate**

```ts
// In lib/postgres/login-throttle.test.ts  (new file)
import test from 'node:test'
import assert from 'node:assert/strict'

// This test verifies pruneLoginAttempts exists and is exported separately
test('pruneLoginAttempts is exported as a standalone function', async () => {
  const mod = await import('./login-throttle.js')
  assert.equal(typeof mod.pruneLoginAttempts, 'function')
})

test('consumeLoginAttempt signature remains unchanged', async () => {
  const mod = await import('./login-throttle.js')
  assert.equal(typeof mod.consumeLoginAttempt, 'function')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern "pruneLoginAttempts"
```
Expected: FAIL — `pruneLoginAttempts` not exported.

- [ ] **Step 3: Implement the fix**

Replace the body of `lib/postgres/login-throttle.ts`:

```ts
import 'server-only'
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { getAuthDatabase } from './db'

/** Persistent budgets independent of spoofable forwarding headers. */
export async function consumeLoginAttempt(identifier: string): Promise<boolean> {
  const key = createHash('sha256').update(identifier.trim().toLowerCase()).digest('hex')
  return getAuthDatabase().transaction(async tx => {
    // NOTE: Cleanup of old rows is intentionally NOT here — call pruneLoginAttempts()
    // via after() in the login action so it never contends with the login transaction.
    for (const [bucket, limit] of [['global', 200], [key, 10]] as const) {
      const result = await tx.execute<{ attempts: number }>(sql`
        insert into private_auth.login_attempts(key,attempts) values(${bucket},1)
        on conflict (key) do update set
          attempts=case when login_attempts.window_started_at < now()-interval '1 minute' then 1 else least(login_attempts.attempts+1,${limit+1}) end,
          window_started_at=case when login_attempts.window_started_at < now()-interval '1 minute' then now() else login_attempts.window_started_at end
        returning attempts`)
      if (result.rows[0].attempts > limit) return false
    }
    return true
  })
}

/** Remove expired login-attempt rows. Call via after() so it never blocks the hot path. */
export async function pruneLoginAttempts(): Promise<void> {
  await getAuthDatabase().execute(
    sql`delete from private_auth.login_attempts where window_started_at < now() - interval '1 day'`
  )
}
```

- [ ] **Step 4: Wire pruneLoginAttempts into the login action via after()**

Find the login server action (search `consumeLoginAttempt` usages). It will be in `features/auth/actions.ts` or similar. Add:

```ts
import { after } from 'next/server'
import { pruneLoginAttempts } from '@/lib/postgres/login-throttle'

// Inside the login action, AFTER consumeLoginAttempt is called:
after(() => pruneLoginAttempts().catch(() => { /* best-effort */ }))
```

> **Important:** `after()` runs after the response is sent. The cleanup failure must not propagate — wrap in `.catch()`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --test-name-pattern "pruneLoginAttempts|consumeLoginAttempt"
```
Expected: PASS — both tests green.

- [ ] **Step 6: Commit**

```bash
git add lib/postgres/login-throttle.ts
git commit -m "perf(auth): move login-attempt cleanup out of hot-path transaction"
```

---

## Task 2: Replace In-Memory Rate Limiter with PostgreSQL-Backed Implementation

**Problem:** `MemoryRateLimiter` stores state in a local `Map`. On process restart (deploy, crash, OOM-kill) all rate-limit windows reset. Also, any future horizontal scaling (multiple containers) would defeat it completely.

**Root cause confirmed:** `lib/rate-limit.ts` lines 29–91 — `class MemoryRateLimiter implements RateLimiter`.

**Fix:** Add a `PostgresRateLimiter` that uses a `private_auth.rate_limits` table with upsert. The existing `RateLimiter` interface and all call sites remain unchanged — only the singleton returned by `getRateLimiter()` changes when `DATA_BACKEND=postgres`.

**Files:**
- New: `db/postgres/migrations/0005_rate_limits_table.sql`
- Modify: `lib/postgres/db.ts` (no change needed — reuses `getAuthDatabase()`)
- Modify: `lib/rate-limit.ts` (add `PostgresRateLimiter`, update `getRateLimiter`)
- Modify: `lib/rate-limit.test.ts` (add `PostgresRateLimiter` contract tests)

**Interfaces:**
- Produces: `class PostgresRateLimiter implements RateLimiter` — same `limit(key, limit, windowMs)` signature.
- Produces: `getRateLimiter(): RateLimiter` — returns `PostgresRateLimiter` when `DATA_BACKEND=postgres`, else `MemoryRateLimiter` (keeps dev/test parity).

### Sub-task 2a: Database Migration

- [ ] **Step 1: Write migration file**

Create `db/postgres/migrations/0005_rate_limits_table.sql`:

```sql
CREATE TABLE "private_auth"."rate_limits" (
  "key"             text PRIMARY KEY NOT NULL,
  "window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "count"           integer NOT NULL DEFAULT 0
);

CREATE INDEX "rate_limits_window_index"
  ON "private_auth"."rate_limits" USING btree ("window_started_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON private_auth.rate_limits TO camms_auth;
```

- [ ] **Step 2: Apply migration to local Docker Postgres**

```bash
npm run db:migrate
```
Expected: Migration applied without error.

### Sub-task 2b: PostgresRateLimiter Implementation

- [ ] **Step 3: Write the failing contract test**

Add to `lib/rate-limit.test.ts`:

```ts
import { PostgresRateLimiter } from './rate-limit'

test('PostgresRateLimiter is exported', async () => {
  const mod = await import('./rate-limit.js')
  assert.equal(typeof mod.PostgresRateLimiter, 'function')
})

test('getRateLimiter returns PostgresRateLimiter when DATA_BACKEND=postgres', async () => {
  process.env.DATA_BACKEND = 'postgres'
  // Reset module cache to pick up env change
  const mod = await import('./rate-limit.js')
  // In non-request context getRateLimiter falls back gracefully
  assert.ok(mod.getRateLimiter() !== undefined)
  delete process.env.DATA_BACKEND
})
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npm test -- --test-name-pattern "PostgresRateLimiter"
```
Expected: FAIL.

- [ ] **Step 5: Implement PostgresRateLimiter**

Add to `lib/rate-limit.ts` (after the `MemoryRateLimiter` class):

```ts
import { sql } from 'drizzle-orm'
import { getAuthDatabase } from '@/lib/postgres/db'

export class PostgresRateLimiter implements RateLimiter {
  async limit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now()
    const windowSec = windowMs / 1000
    const db = getAuthDatabase()

    const result = await db.execute<{ count: number; window_started_at: string }>(sql`
      INSERT INTO private_auth.rate_limits(key, window_started_at, count)
      VALUES (${key}, now(), 1)
      ON CONFLICT (key) DO UPDATE SET
        window_started_at = CASE
          WHEN rate_limits.window_started_at < now() - make_interval(secs => ${windowSec})
          THEN now()
          ELSE rate_limits.window_started_at
        END,
        count = CASE
          WHEN rate_limits.window_started_at < now() - make_interval(secs => ${windowSec})
          THEN 1
          ELSE least(rate_limits.count + 1, ${limit + 1})
        END
      RETURNING count, window_started_at
    `)

    const row = result.rows[0]
    if (!row) return { success: false, limit, remaining: 0, reset: now + windowMs }

    const windowStartMs = new Date(row.window_started_at).getTime()
    const reset = windowStartMs + windowMs

    if (row.count > limit) {
      return { success: false, limit, remaining: 0, reset }
    }

    return {
      success: true,
      limit,
      remaining: limit - row.count,
      reset,
    }
  }
}
```

Update `getRateLimiter()` to return `PostgresRateLimiter` in postgres mode:

```ts
export function getRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = process.env.DATA_BACKEND === 'postgres'
      ? new PostgresRateLimiter()
      : new MemoryRateLimiter()
  }
  return globalRateLimiter
}
```

> **Note:** `MemoryRateLimiter` is retained for Supabase/dev mode where `DATA_BACKEND` is not `postgres`.

- [ ] **Step 6: Run all rate-limit tests**

```bash
npm test -- --test-name-pattern "RateLimiter|checkRateLimit"
```
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add lib/rate-limit.ts db/postgres/migrations/0005_rate_limits_table.sql lib/rate-limit.test.ts
git commit -m "feat(rate-limit): add PostgresRateLimiter backed by private_auth.rate_limits"
```

---

## Task 3: Reduce bodySizeLimit to Prevent Event-Loop Blocking

**Problem:** `next.config.ts` sets `bodySizeLimit: '52mb'`. Parsing a 52 MB JSON payload synchronously in Node.js blocks the event loop, causing latency spikes for all concurrent requests on the same instance.

**Root cause confirmed:** `next.config.ts` lines 9–13:
```ts
experimental: {
  proxyClientMaxBodySize: '52mb',
  serverActions: {
    bodySizeLimit: '52mb',
  },
},
```

**Background:** The comment says "A 25 MiB JSON backup is itself encoded inside an action string. Escaping can double its size." The backup action is the only reason for this limit. The fix is to use a presigned upload URL for backups, bypassing the server action body parser entirely.

**Files:**
- Modify: `next.config.ts`
- Research: `app/` — find the backup/restore server action that receives large payloads

**Open question resolved:** The backup is a JSON file of up to ~25 MB → base64/JSON-escaping inside a multipart form doubles it to ~52 MB. The presigned URL approach lets the browser upload directly to the storage bucket, bypassing Next.js entirely.

### Sub-task 3a: Lower the body limit

- [ ] **Step 1: Write a config test**

Add `lib/config.test.ts` (or add to existing tests):

```ts
// Verify the next.config limit is not larger than 10mb
// (manual check — automated by build lint rule below)
test('next.config bodySizeLimit is sane', async () => {
  const fs = await import('node:fs/promises')
  const content = await fs.readFile('next.config.ts', 'utf8')
  assert.ok(
    !content.includes('52mb'),
    'bodySizeLimit must not be 52mb — use presigned uploads for large files'
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern "bodySizeLimit"
```
Expected: FAIL — file contains `52mb`.

- [ ] **Step 3: Update next.config.ts**

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  compress: true,
  output: 'standalone',
  experimental: {
    // 10 MB covers normal form submissions and small JSON payloads.
    // Large backups (≤25 MB) use presigned storage URLs and bypass this limit.
    proxyClientMaxBodySize: '10mb',
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
```

- [ ] **Step 4: Find the backup action that needs presigned URL**

Run:
```bash
grep -r "backup\|restore\|52mb\|bodySizeLimit" app/ --include="*.ts" -l
```

Then read that file to understand the upload mechanism. If the backup action already sends to storage (Supabase or local), no client changes are needed — the large payload was the file content being passed through the action instead of uploaded directly.

- [ ] **Step 5: If backup action receives file content, convert to presigned URL flow**

In the relevant action file, replace `file.arrayBuffer()` pattern with:

```ts
// Server action: returns a presigned URL for the client to upload directly
export async function getBackupUploadUrl(): Promise<{ url: string; path: string }> {
  // ... auth check ...
  const path = `backups/${Date.now()}-restore.json`
  const { data, error } = await supabase.storage
    .from('backups')
    .createSignedUploadUrl(path)
  if (error) throw new Error('Could not generate upload URL')
  return { url: data.signedUrl, path }
}

// Server action: confirm after client PUT to presigned URL
export async function confirmBackupRestore(path: string): Promise<ActionResult> {
  // ... download from storage, process, delete ...
}
```

> **Note:** If the backup route already streams from local storage without passing the file through the action body, this step may not be needed. Inspect the action before deciding.

- [ ] **Step 6: Run tests**

```bash
npm test -- --test-name-pattern "bodySizeLimit"
npm run build
```
Expected: Test passes, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add next.config.ts
git commit -m "perf(config): reduce bodySizeLimit to 10mb, document presigned URL path for backups"
```

---

## Task 4: Fix Metrics Memory Pressure (GC Churn)

**Problem:** `MemoryMetricsExporter` keeps a raw array of up to 10,000 `MetricSnapshot` objects. The `.shift()` on every overflow means O(n) reallocation. High-frequency metrics (e.g., request timers) cause GC pressure.

**Root cause confirmed:** `lib/metrics.ts` lines 19–28:
```ts
class MemoryMetricsExporter implements MetricsExporter {
  private snapshots: MetricSnapshot[] = []
  private readonly maxSnapshots = 10_000

  record(snapshot: MetricSnapshot): void {
    this.snapshots.push(snapshot)
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift()  // O(n) — bad
    }
  }
```

**Fix:** Replace raw snapshot array with per-metric rolling aggregates. Keep the last N raw snapshots only for active debugging (configurable, default 500). `getAggregates()` remains O(1) by maintaining running totals.

**Files:**
- Modify: `lib/metrics.ts`

**Interfaces:**
- Produces: `MemoryMetricsExporter` — same public API (`record`, `getSnapshots`, `getAggregates`, `reset`).
- `getAggregates()` now returns from pre-computed state (O(1)) instead of iterating all snapshots (O(n)).

- [ ] **Step 1: Write the failing performance test**

Add to `lib/metrics.test.ts` (new file or existing):

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { metrics } from './metrics.js'

test('MemoryMetricsExporter does not grow unboundedly', () => {
  // Record 600 snapshots — should not keep more than 500 raw
  for (let i = 0; i < 600; i++) {
    metrics.counter('test.counter', 1, { i: String(i) })
  }
  const exporter = metrics._getMemoryExporter()
  const snaps = exporter.getSnapshots()
  assert.ok(snaps.length <= 500, `Expected ≤500 snapshots, got ${snaps.length}`)
})

test('getAggregates returns correct totals without iterating all snapshots', () => {
  metrics._getMemoryExporter().reset()
  metrics.counter('items.created', 1)
  metrics.counter('items.created', 1)
  metrics.timer('query.duration', 100)
  const agg = metrics._getMemoryExporter().getAggregates()
  assert.equal(agg['counter:items.created']?.count, 2)
  assert.equal(agg['counter:items.created']?.sum, 2)
  assert.equal(agg['timer:query.duration']?.count, 1)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --test-name-pattern "MemoryMetricsExporter"
```
Expected: FAIL — 600 snapshots stored.

- [ ] **Step 3: Implement the fix**

Replace `lib/metrics.ts` body:

```ts
import { config } from '@/lib/config'

export type MetricLabels = Record<string, string | number | boolean>

export interface MetricSnapshot {
  name: string
  type: 'counter' | 'histogram' | 'timer'
  value: number
  labels: MetricLabels
  timestamp: string
}

export interface MetricsExporter {
  record(snapshot: MetricSnapshot): void
  flush?(): Promise<void>
}

interface MetricAggregate {
  count: number
  sum: number
  min: number
  max: number
}

/** In-memory exporter — pluggable; swap for Prometheus/Datadog without changing call sites.
 *  Maintains O(1) aggregates and a bounded ring of raw snapshots (default 500) for debugging.
 */
class MemoryMetricsExporter implements MetricsExporter {
  private readonly maxSnapshots: number
  /** Circular buffer for raw snapshots (debug only). */
  private ring: MetricSnapshot[]
  private ringHead = 0
  private ringCount = 0
  /** Pre-computed aggregates — O(1) read, no snapshot scan needed. */
  private aggregates: Record<string, MetricAggregate> = {}

  constructor(maxSnapshots = 500) {
    this.maxSnapshots = maxSnapshots
    this.ring = new Array(maxSnapshots)
  }

  record(snapshot: MetricSnapshot): void {
    // Write into circular buffer (overwrites oldest when full)
    this.ring[this.ringHead] = snapshot
    this.ringHead = (this.ringHead + 1) % this.maxSnapshots
    if (this.ringCount < this.maxSnapshots) this.ringCount++

    // Update running aggregates — O(1)
    const key = `${snapshot.type}:${snapshot.name}`
    const agg = this.aggregates[key]
    if (!agg) {
      this.aggregates[key] = { count: 1, sum: snapshot.value, min: snapshot.value, max: snapshot.value }
    } else {
      agg.count++
      agg.sum += snapshot.value
      if (snapshot.value < agg.min) agg.min = snapshot.value
      if (snapshot.value > agg.max) agg.max = snapshot.value
    }
  }

  getSnapshots(): MetricSnapshot[] {
    if (this.ringCount < this.maxSnapshots) {
      return this.ring.slice(0, this.ringCount)
    }
    // Reconstruct chronological order from circular buffer
    return [
      ...this.ring.slice(this.ringHead),
      ...this.ring.slice(0, this.ringHead),
    ]
  }

  getAggregates(): Record<string, MetricAggregate> {
    return { ...this.aggregates }
  }

  reset(): void {
    this.ring = new Array(this.maxSnapshots)
    this.ringHead = 0
    this.ringCount = 0
    this.aggregates = {}
  }
}

const defaultExporter = new MemoryMetricsExporter()
let activeExporter: MetricsExporter = defaultExporter

export function setMetricsExporter(exporter: MetricsExporter): void {
  activeExporter = exporter
}

export function resetMetricsExporter(): void {
  activeExporter = defaultExporter
  defaultExporter.reset()
}

function emit(type: MetricSnapshot['type'], name: string, value: number, labels: MetricLabels = {}): void {
  if (!config.observability.metricsEnabled) return
  activeExporter.record({ name, type, value, labels, timestamp: new Date().toISOString() })
}

export const metrics = {
  counter(name: string, value = 1, labels?: MetricLabels): void { emit('counter', name, value, labels) },
  histogram(name: string, value: number, labels?: MetricLabels): void { emit('histogram', name, value, labels) },
  timer(name: string, durationMs: number, labels?: MetricLabels): void { emit('timer', name, durationMs, labels) },
  itemCreated(): void { this.counter('items.created', 1) },
  itemDeleted(): void { this.counter('items.deleted', 1) },
  loginSuccess(): void { this.counter('login.success', 1) },
  loginFailure(): void { this.counter('login.failure', 1) },
  csvImport(rows: number): void { this.counter('csv.import', 1, { rows }) },
  _getMemoryExporter(): MemoryMetricsExporter { return defaultExporter },
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --test-name-pattern "MemoryMetrics|metrics"
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/metrics.ts
git commit -m "perf(metrics): replace O(n) snapshot array with O(1) ring buffer + running aggregates"
```

---

## Verification Plan

### Automated Tests

Run full test suite:
```bash
npm test
```

Run TypeScript type-check:
```bash
npm run typecheck
```

Run build:
```bash
npm run build
```

Run rate-limit specific tests:
```bash
npm test -- --test-name-pattern "RateLimiter|rate.limit"
```

Run login-throttle tests:
```bash
npm test -- --test-name-pattern "pruneLoginAttempts|consumeLoginAttempt|throttle"
```

Run metrics tests:
```bash
npm test -- --test-name-pattern "metrics|MemoryMetrics"
```

### Manual Verification

1. **Login throttle:** Log in 11 times in 1 minute → confirm 11th attempt is blocked. Confirm old rows are cleaned up eventually (check DB `SELECT count(*) FROM private_auth.login_attempts`).

2. **Rate limiter:** Start the app in production mode (`npm run build && npm start`). Restart the Node.js process. Make `curl` requests to a rate-limited endpoint — confirm the counter reset does NOT happen after restart (PostgresRateLimiter persists in DB).

3. **bodySizeLimit:** Attempt to POST a payload > 10 MB to a server action → confirm 413 is returned. Confirm the backup workflow still functions via the presigned URL path.

4. **Metrics:** Check the health/metrics endpoint (if exposed) — confirm aggregates report correctly after high-frequency events.

### Database Health

After deploying migration:
```sql
-- Confirm table created
SELECT count(*) FROM private_auth.rate_limits;
-- Confirm index exists
SELECT indexname FROM pg_indexes WHERE tablename = 'rate_limits';
```
