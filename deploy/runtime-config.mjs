import { parseEnv } from 'node:util'

/** Load only the two restricted connection strings, never migration-owner credentials. */
export function runtimeConnections(text) {
  const parsed = parseEnv(text)
  const expected = { DATABASE_URL: 'camms_app', DATABASE_AUTH_URL: 'camms_auth' }
  if (Object.keys(parsed).some(key => !Object.hasOwn(expected, key))) throw new Error('Runtime secret contains an unexpected key')
  for (const [key, role] of Object.entries(expected)) {
    let url
    try { url = new URL(parsed[key]) } catch { throw new Error(`Missing or invalid ${key}`) }
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || decodeURIComponent(url.username) !== role || !url.password) {
      throw new Error(`${key} must use the restricted ${role} login`)
    }
  }
  const app = new URL(parsed.DATABASE_URL), auth = new URL(parsed.DATABASE_AUTH_URL)
  if (app.hostname !== auth.hostname || app.port !== auth.port || app.pathname !== auth.pathname) throw new Error('Runtime connections must target the same database')
  return parsed
}
