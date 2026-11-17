# Scheduled PostgreSQL backups on Windows

The runner uses the existing `npm run backup:release -- <absolute-directory>` operation, which writes a full database dump, private files and a completion manifest after verification. No task is installed automatically. Choose an actual off-machine destination and an account with read access to the project secrets, Docker access and write access to the backup directory. For a NAS, use a UNC directory (`\\server\share\CAMMS`) with account permissions; mapped drive letters are usually unavailable to scheduled tasks. A local directory alone does not protect against losing this computer.

Use PowerShell 7 from the project directory. Preview registration first:

```powershell
./scripts/install-postgres-backup-task.ps1 -Destination '<absolute-existing-backup-directory>' -At '02:00' -WhatIf
./scripts/install-postgres-backup-task.ps1 -Destination '<absolute-existing-backup-directory>' -At '02:00'
```

Replace the placeholder with the real dedicated directory. The second command asks for the Windows task account. Windows stores its password; the generated config contains only the destination. The script refuses to replace an existing task. The account needs permission to log on as a batch job. Keep the project and its `.env` files restricted to the service/task account and administrators. Docker and PostgreSQL must be running at the scheduled time; Docker Desktop may depend on a signed-in desktop session, so verify operation in the actual unattended deployment arrangement.

The daily task runs missed schedules when available and ignores overlapping starts. The job also obtains an exclusive local lock. Each of three attempts has a ten-minute subprocess timeout and failures pause one minute before retrying. Task Scheduler has a forty-minute overall execution limit, including destination/network operations. Subprocess output and raw database errors are not logged. Task arguments contain paths only.

After registration, run and verify the task under its configured account:

```powershell
Start-ScheduledTask -TaskName 'CAMMS PostgreSQL Daily Backup'
Get-ScheduledTaskInfo -TaskName 'CAMMS PostgreSQL Daily Backup'
Get-Content -LiteralPath './.cache/postgres-backup-job/status.json'
```

A completed task result of `0` and `state: succeeded` with a recent `lastSuccessAt` indicate a completed backup. Result `1` indicates failure; `2` indicates an existing job lock, also recorded in `last-blocked.json` without overwriting the running job’s status. While a task is running, Windows may report a running status instead of its final result. `status.json` records attempt count, last successful time and completed backup path. A failed run preserves the previous successful time. Check the timestamp daily; this does not send notifications to an external monitoring service.

If the process or computer crashes, the lock deliberately remains. Inspect `job.lock`, the recorded PID and process command line, Task Scheduler state, Docker activity and `status.json`. Only after confirming no backup is still running should an operator remove that exact local lock file and restart the task. Never automatically remove locks based only on age.

## Retention and recovery policy

Automatic deletion is intentionally disabled. Keep every completed backup for **at least 30 days**, and always keep **at least the two newest independently verified full backups**, even when older than 30 days. Incomplete directories without a valid `camms-postgres-full` version 1 manifest are not successful recovery points and must not count toward these minimums. A completion manifest is produced only after the backup's storage inventory is verified.

Before manually retiring any older backup, resolve the absolute destination and candidate path, confirm the candidate is a direct child named `camms-postgres-*`, reject symbolic links/junctions, validate the manifest, dump hash and storage hashes, and confirm the retention minimums against other verified completed backups. Do not prune unrelated files, incomplete runs or directories outside that destination. Use native PowerShell `Remove-Item -LiteralPath` only after these checks. NAS snapshots or immutable retention provide an additional recovery layer. Check available space and rehearse full recovery regularly; a successful scheduled backup does not by itself prove recovery.
