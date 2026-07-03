# Security Policy & Implementation details (SECURITY.md)

This document details the security posture, defensive configurations, and security features implemented in Registry-S (CAMMS).

---

## 1. Security Headers Configuration

The application enforces strict security headers on all edge responses via the root `proxy.ts` middleware and `next.config.ts`.

### Active Headers
- **Content-Security-Policy (CSP):** Restricts script, style, and connect endpoints.
  - `default-src 'self'`
  - `frame-ancestors 'none'`
  - `object-src 'none'`
  - `img-src 'self' blob: data: https://*.supabase.co https://images.unsplash.com`
  - `style-src 'self' 'unsafe-inline'`
  - `script-src 'self' 'unsafe-inline' 'unsafe-eval'`
  - `connect-src 'self' https://*.supabase.co wss://*.supabase.co`
- **X-Frame-Options:** Set to `DENY` to prevent clickjacking attacks.
- **X-Content-Type-Options:** Set to `nosniff` to prevent content-type sniffing.
- **Referrer-Policy:** Set to `strict-origin-when-cross-origin`.
- **Strict-Transport-Security (HSTS):** Set to `max-age=31536000; includeSubDomains; preload`.
- **Cross-Origin-Opener-Policy (COOP):** Set to `same-origin`.
- **Cross-Origin-Resource-Policy (CORP):** Set to `same-origin`.
- **Permissions-Policy:** Blocks camera, microphone, geolocation, and interest-cohort tracking.

---

## 2. In-Memory Sliding Window Rate Limiting

To prevent brute force, scraping, and denial of service (DoS), Server Actions are protected by an extensible rate limiter interface (`RateLimiter`).

- **Identifier Key:** IP Address (`x-forwarded-for`) + Authenticated User ID (`getCurrentProfile().id`) + Action Route path.
- **Limit Constraints:** Defaults to 60 requests per minute per key window.
- **Storage:** Sliding window state is maintained in-memory via `MemoryRateLimiter` with an active background pruning timer (`.unref()` compatible). Extensible to Redis/Upstash for multi-node deployments.

---

## 3. Inputs Hardening & Sanitization

- **Zod Data Constraints:** Explicit character limits on string schemas prevent massive memory allocations (e.g. Item Name <= 255, brand/model <= 150, description/note <= 1000-2000).
- **Unicode Normalization:** All inputs are preprocessed through NFC normalization to ensure character consistency.
- **CSV Injection Prevention:** Any cell value starting with formula trigger prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) is prepended with a single quote `'` during CSV import and exports, neutralizing spreadsheet cell formula executions.
- **HTML Injection:** Standard React-DOM auto-escaping processes all text bindings, avoiding simple HTML/XSS injection vulnerabilities. Raw HTML rendering is strictly forbidden.
- **Filename Validation:** Special path symbols are replaced by underscores using `normalizeFilename` to prevent directory traversal or invalid path injection during image uploads.
