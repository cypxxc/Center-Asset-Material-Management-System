import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import('./backup-postgres').then(({ backupPostgres }) => backupPostgres(process.argv[2]))
  .catch(error => { console.error(error instanceof Error ? error.message : 'Backup failed'); process.exitCode = 1 })
