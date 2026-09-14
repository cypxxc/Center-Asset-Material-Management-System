import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
async function main() {
  if (process.env.DATA_BACKEND === 'postgres') await (await import('./backup-postgres')).backupPostgres(process.argv[2])
  else await import('./backup-release')
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Backup failed'); process.exitCode=1 })
