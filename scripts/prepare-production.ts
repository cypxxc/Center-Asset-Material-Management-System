import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'dotenv'

// Explicit preparation only: never starts containers, changes .env.local, or installs a CA.
function main() {
  const args = process.argv.slice(2)
  const options: Record<string, string> = {}
  for (let i = 0; i < args.length; i += 2) {
    if (!['--site', '--tls', '--bind', '--https-port', '--http-port'].includes(args[i]) || !args[i + 1]) throw new Error('Usage: tsx scripts/prepare-production.ts --site hostname --tls public|internal [--bind address] [--https-port port] [--http-port port]')
    options[args[i]] = args[i + 1]
  }
  const hostname = options['--site']
  if (!hostname || hostname.length > 253 || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(hostname)) throw new Error('An explicit hostname or IPv4 address is required; omit scheme, port and path')
  const tls = options['--tls']
  if (!['public', 'internal'].includes(tls)) throw new Error('Choose --tls public or --tls internal explicitly')
  const bind = options['--bind'] || '127.0.0.1'
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(bind) || bind.split('.').some(part => Number(part) > 255)) throw new Error('Binding must be an explicit IPv4 address')
  const httpPort = options['--http-port'] || '80', httpsPort = options['--https-port'] || '443'
  for (const port of [httpPort, httpsPort]) if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Invalid port')
  const configFile = '.env.production.compose', secretFile = '.env.production.runtime'
  if (existsSync(configFile) || existsSync(secretFile)) throw new Error('Production configuration already exists; review it manually rather than overwrite it')
  const app = parse(readFileSync('.env.postgres.app'))
  const storage = resolve(app.LOCAL_STORAGE_PATH)
  if (!existsSync(storage)) throw new Error('Existing upload directory is missing')
  const runtime: Record<string, string> = {}
  for (const [key, username] of [['DATABASE_URL', 'camms_app'], ['DATABASE_AUTH_URL', 'camms_auth']]) {
    const url = new URL(app[key])
    if (url.username !== username || !url.password || url.pathname !== '/camms_registry') throw new Error('Expected existing restricted camms_registry connections')
    url.hostname = 'postgres'; url.port = '5432'
    runtime[key] = url.toString()
  }
  const deployment = {
    CAMMS_SITE: `https://${hostname}`,
    CAMMS_CADDYFILE: `./deploy/Caddyfile.${tls}`,
    CAMMS_BIND_ADDRESS: bind,
    CAMMS_HTTP_PORT: httpPort,
    CAMMS_HTTPS_PORT: httpsPort,
    CAMMS_DATABASE_NETWORK: 'camms-postgres-local_default',
    CAMMS_STORAGE_HOST_PATH: storage.replaceAll('\\', '/'),
    CAMMS_RUNTIME_SECRET_FILE: secretFile,
  }
  const encode = (values: Record<string, string>) => Object.entries(values).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n'
  writeFileSync(secretFile, encode(runtime), { flag: 'wx', mode: 0o600 })
  writeFileSync(configFile, encode(deployment), { flag: 'wx', mode: 0o600 })
  console.log(`Prepared ${configFile} and restricted runtime secret. No services started; existing database and files retained.`)
}
try { main() } catch (error) { console.error(error instanceof Error ? error.message : 'Production preparation failed'); process.exitCode = 1 }
