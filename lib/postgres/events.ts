import 'server-only'
import { EventEmitter } from 'node:events'
import { Client } from 'pg'
type Hub = { emitter: EventEmitter; userCounts: Map<string, number>; connecting?: Promise<void>; client?: Client; retry?: ReturnType<typeof setTimeout> }
const root = globalThis as typeof globalThis & { cammsEvents?: Hub }
const hub: Hub = root.cammsEvents ??= { emitter: new EventEmitter().setMaxListeners(200), userCounts: new Map<string, number>() }
const MAX_SSE_PER_USER = 10
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
export async function subscribeChanges(listener: (table: string) => void, reconnect: () => void, userId?: string) {
  if (hub.emitter.listenerCount('change') >= 150) throw new Error('Event connection limit reached')
  if (userId && (hub.userCounts.get(userId) ?? 0) >= MAX_SSE_PER_USER) {
    throw new Error('Too many event connections for user')
  }
  await connect()
  // Re-check after await connect() to prevent concurrent bursts from exceeding the per-user cap.
  if (userId && (hub.userCounts.get(userId) ?? 0) >= MAX_SSE_PER_USER) {
    throw new Error('Too many event connections for user')
  }
  if (userId) hub.userCounts.set(userId, (hub.userCounts.get(userId) ?? 0) + 1)
  hub.emitter.on('change', listener); hub.emitter.on('reconnect', reconnect)
  let released = false
  return () => {
    if (released) return
    released = true
    hub.emitter.off('change', listener); hub.emitter.off('reconnect', reconnect)
    if (userId) {
      const next = (hub.userCounts.get(userId) ?? 1) - 1
      if (next <= 0) hub.userCounts.delete(userId)
      else hub.userCounts.set(userId, next)
    }
  }
}
