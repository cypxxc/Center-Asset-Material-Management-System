# Backup Strategy Guide (BACKUP.md)

Registry-S (CAMMS) data recovery plans rely on backup policies for both the Postgres database and Supabase storage buckets.

---

## 1. Database Backups (Supabase Postgres)

Supabase handles physical database backups automatically:

- **Daily Backups:** Automatic daily backups are retained for 7 to 30 days depending on project tier.
- **Point-in-Time Recovery (PITR):** Enables recovery down to the exact second of database state, preventing data loss in database corruption incidents.
- **Manual Logical Backups:** Can be taken using `pg_dump`:
  ```bash
  # Dump schema and data to a file
  pg_dump -h db.your-project.supabase.co -U postgres -d postgres -F c -b -v -f camms_backup.dump
  ```

---

## 2. Storage Backups (item-images Bucket)

File attachments and product images inside `item-images` should be replicated:

- **Bucket Policy:** Ensure bucket has versioning enabled (where supported) to prevent accidental overwrites.
- **Media Backup Script:** Sync local folders or mirror storage assets to secondary cold buckets (e.g. AWS S3 or GCP Cloud Storage) using Supabase CLI commands.
