/** Configuration for the isolated Docker connection test, not the application backend. */
export function localPostgresConfig(env: Record<string, string | undefined>) {
  if (Object.keys(env).some((key) => key.startsWith('PG') || key.includes('DATABASE_URL'))) {
    throw new Error('Connection overrides are not allowed in the local PostgreSQL test configuration')
  }
  const user = env.POSTGRES_USER
  const password = env.POSTGRES_PASSWORD
  const database = env.POSTGRES_DB
  const port = env.POSTGRES_PORT
  if (!user || !database || !password || !/^[0-9]+$/.test(port ?? '') || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('Local PostgreSQL user, password, database and valid port are required; run npm run postgres:setup')
  }
  return {
    database,
    port: Number(port),
    connectionString: `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/${encodeURIComponent(database)}`,
  }
}

export function withoutSupabase(env: Record<string, string | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(env).filter(([key]) => {
    const name = key.toUpperCase()
    return !name.includes('SUPABASE') && !name.startsWith('PG') && !name.startsWith('POSTGRES_') && !name.includes('DATABASE_URL') && !name.startsWith('COMPOSE_')
  }))
}
