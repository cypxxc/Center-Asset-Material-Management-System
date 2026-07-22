# Incident Response Runbook (RUNBOOK.md)

This runbook helps SREs and developers debug, recover, and mitigate production incidents.

---

## 1. System Health Checklist

If the system experiences downtime, check:
1. **Health Endpoint:** Run `curl -i https://<your-domain>/api/health`.
   - If status is `503`, check `database` and `storage` fields.
2. **Supabase Dashboard:** Check project API requests, server load, and database pings.
3. **Application Logs:** Search server standard output for `[CAMMS-ERROR]` or `[CAMMS-WARN]`.

---

## 2. Common Issues & Mitigation

### Database Connection Timeout
- **Symptom:** Logs show `[CAMMS-ERROR]` with `Database connection timeout` or Supabase client connection errors.
- **Resolution:**
  1. Verify Supabase project status is "Active" (not paused due to inactivity).
  2. If using local pools, verify pgBouncer connections aren't exhausted.

### Storage Upload Errors (Status 403 or 409)
- **Symptom:** Users get error alerts when uploading asset images.
- **Resolution:**
  1. Confirm the `item-images` bucket exists in Supabase.
  2. Verify that Supabase RLS Storage policies allow authenticated users to upload files.

### Rate Limiting Blocks
- **Symptom:** Legitimate users get the message `คุณส่งคำขอมากเกินไป กรุณารออีก...` (Rate limit exceeded).
- **Resolution:**
  1. If traffic is legitimate, increase default limits in the Server Action caller (e.g. `checkRateLimit('action', 60)`).
  2. If a single IP is flooding requests, block the client IP at the firewall level (e.g., Cloudflare, Vercel).

---

## 3. Recovery Procedures

If a deployment introduces regressions:
1. **Rollback Release:** In the hosting platform (Vercel or custom server), promote the previous stable build hash.
2. **Remediate Migrations Forward:** If a migration broke the database schema, stop the release and keep the previous compatible application build active. Prepare, review, and apply a new forward-only corrective migration; do not attempt an ad-hoc reverse migration.
3. **Restore When Required:** If forward remediation cannot safely recover the database, restore the verified backup through the documented recovery procedure in `RECOVERY.md`.
4. **Sidebar Cache Flush:** If counts or item references become stale, trigger revalidation by making a dummy item modification or restarting Next.js instance to refresh `unstable_cache`.
