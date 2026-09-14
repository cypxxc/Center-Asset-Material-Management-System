import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, openSync, closeSync } from 'node:fs'
import { mkdir, cp, writeFile, readdir, lstat } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { withoutSupabase } from './postgres-local-config'

export async function storageInventory(root: string, prefix = ''): Promise<Array<{name:string;bytes:number;sha256:string}>> {
  const result: Array<{name:string;bytes:number;sha256:string}> = []
  for (const name of (await readdir(path.join(root,prefix))).sort()) {
    const relative = path.join(prefix,name)
    const file = path.join(root,relative)
    const stat = await lstat(file)
    if (stat.isSymbolicLink()) throw new Error('Storage backups do not accept symbolic links')
    if (stat.isDirectory()) result.push(...await storageInventory(root,relative))
    else if (stat.isFile()) result.push({name:relative.split(path.sep).join('/'),bytes:stat.size,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')})
    else throw new Error('Unsupported storage file type')
  }
  return result
}

export async function backupPostgres(destinationRoot: string | undefined, overrides?: {migrationUrl:string;storagePath:string}) {
  if (!destinationRoot || !path.isAbsolute(destinationRoot)) throw new Error('Usage: npm run backup:release -- <absolute-destination-directory>')
  const config=parse(readFileSync('.env.postgres.app'))
  const local=parse(readFileSync('.env.postgres.local'))
  const migrationUrl=overrides?.migrationUrl ?? config.DATABASE_MIGRATION_URL
  const storagePath=path.resolve(overrides?.storagePath ?? config.LOCAL_STORAGE_PATH)
  const database=decodeURIComponent(new URL(migrationUrl).pathname.slice(1))
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database)) throw new Error('Invalid backup database name')
  const backupDir=path.join(destinationRoot,`camms-postgres-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID()}`)
  const relativeDestination=path.relative(storagePath,backupDir)
  if (!relativeDestination || (!relativeDestination.startsWith('..'+path.sep) && relativeDestination!=='..' && !path.isAbsolute(relativeDestination))) throw new Error('Backup destination must be outside private storage')
  const env: NodeJS.ProcessEnv={...withoutSupabase(process.env), NODE_ENV:process.env.NODE_ENV ?? 'development'}
  const container=spawnSync('docker',['compose','--env-file','.env.postgres.local','-f','compose.postgres.yaml','ps','-q','postgres'],{env,encoding:'utf8',timeout:15000})
  const id=container.stdout?.trim()
  if (container.status!==0 || !/^[a-f0-9]{12,64}$/.test(id ?? '')) throw new Error('Docker PostgreSQL service must be running')
  const pool=new Pool({connectionString:migrationUrl,connectionTimeoutMillis:5000})
  const client=await pool.connect().catch(async error=>{await pool.end();throw error})
  let file: number | undefined
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout='15s'")
    // Keep immutable image files and their committed references consistent while dumping.
    await client.query('LOCK TABLE public.items,public.profiles,public.categories,public.locations,public.units,public.audit_logs,private_auth.credentials,private_auth.sessions,private_auth.login_attempts IN SHARE MODE')
    await mkdir(destinationRoot,{recursive:true})
    await mkdir(backupDir)
    const dumpPath=path.join(backupDir,'database.dump')
    file=openSync(dumpPath,'wx',0o600)
    const dump=spawnSync('docker',['exec',id!,'pg_dump','-U',local.POSTGRES_USER,'-d',database,'--format=custom'],{env,stdio:['ignore',file,'pipe'],timeout:120000})
    closeSync(file);file=undefined
    if (dump.status!==0) throw new Error('PostgreSQL dump failed; the partial backup has no completion manifest')
    const sourceFiles=await storageInventory(storagePath)
    await cp(storagePath,path.join(backupDir,'storage'),{recursive:true,errorOnExist:true,force:false})
    const storageFiles=await storageInventory(path.join(backupDir,'storage'))
    if (JSON.stringify(sourceFiles)!==JSON.stringify(storageFiles)) throw new Error('Storage copy verification failed')
    const manifest={format:'camms-postgres-full',version:1,createdAt:new Date().toISOString(),database,dumpSha256:createHash('sha256').update(readFileSync(dumpPath)).digest('hex'),storageFiles,includes:['business data','profiles and password hashes','sessions','schema and migrations','private uploaded files'],restorePolicy:'Restore into a new database with provisioned camms_app/camms_auth roles. Delete restored sessions before reopening the application.'}
    await client.query('COMMIT')
    await writeFile(path.join(backupDir,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'})
    console.log(`Full PostgreSQL backup completed: ${backupDir}`)
    return backupDir
  } catch(error) { await client.query('ROLLBACK');throw error }
  finally { if(file!==undefined)closeSync(file);client.release();await pool.end() }
}
