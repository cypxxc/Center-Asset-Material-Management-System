import 'server-only'
import { EventEmitter } from 'node:events'
import { Client } from 'pg'
type Hub = { emitter: EventEmitter; connecting?: Promise<void>; client?: Client; retry?: ReturnType<typeof setTimeout> }
const root = globalThis as typeof globalThis & { cammsEvents?: Hub }
const hub = root.cammsEvents ??= { emitter: new EventEmitter().setMaxListeners(200) }
async function connect() {
  if (hub.client || hub.connecting) return hub.connecting
  hub.connecting = (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis:5000 })
    const recover = () => {
      if (hub.client === client) hub.client = undefined
      void client.end().catch(() => {})
      if (!hub.retry) hub.retry = setTimeout(() => { hub.retry=undefined; void connect().catch(() => {}) },5000)
    }
    client.on('error',recover)
    client.on('end',() => { if (hub.client === client) recover() })
    client.on('notification',(notice) => { if (notice.channel === 'camms_changes') { hub.emitter.emit('change',notice.payload); hub.emitter.emit('change','audit_logs') } })
    try { await client.connect(); await client.query('LISTEN camms_changes'); hub.client=client; hub.emitter.emit('reconnect') }
    catch (error) { recover(); throw error }
  })().finally(() => { hub.connecting=undefined })
  return hub.connecting
}
export async function subscribeChanges(listener: (table: string) => void, reconnect: () => void) {
  if (hub.emitter.listenerCount('change') >= 150) throw new Error('Event connection limit reached')
  await connect()
  hub.emitter.on('change',listener); hub.emitter.on('reconnect',reconnect)
  return () => { hub.emitter.off('change',listener); hub.emitter.off('reconnect',reconnect) }
}
