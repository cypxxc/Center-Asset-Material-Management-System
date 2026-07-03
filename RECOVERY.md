# Recovery & Disaster Recovery Plan (RECOVERY.md)

This guide documents the procedures to restore database state or repair storage buckets in disaster recovery events.

---

## 1. Database Restoration Procedures

### Restoring logical pg_dump backups:
```bash
# Restore logical backup using pg_restore
pg_restore -h db.your-project.supabase.co -U postgres -d postgres -v camms_backup.dump
```
*Note: Logical restores may require temporarily disabling Postgres foreign key constraints or RLS triggers during write steps.*

---

## 2. Point-in-Time Recovery (PITR)

For critical data loss incidents (e.g. accidental bulk tables truncate):
1. Navigate to the **Supabase Dashboard** -> **Database** -> **Backups**.
2. Select **Point-in-Time Recovery**.
3. Pick a timestamp *immediately prior* to the incident.
4. Trigger the restore. A new database replica instance is spun up to replace the corrupted instance.

---

## 3. Storage Media Recovery

If attachments are deleted from the `item-images` bucket:
1. Identify the deleted paths from `audit_logs` entries.
2. Retrieve the files from the replicated secondary storage backups.
3. Re-upload files through Vercel or Supabase Storage management dashboard to their exact matching file path names.
