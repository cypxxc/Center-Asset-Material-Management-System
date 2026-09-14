import { readFileSync } from 'node:fs'
import { runtimeConnections } from './runtime-config.mjs'

// Compose mounts this file read-only; credentials are absent from image layers and build args.
Object.assign(process.env, runtimeConnections(readFileSync('/run/secrets/camms_runtime', 'utf8')))
if (process.env.DATABASE_MIGRATION_URL) throw new Error('Migration credentials must not be passed to the application')
await import('../server.js')
