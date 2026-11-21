import { Pool } from 'pg'

export async function checkLocalPostgres(connectionString: string) {
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 })
  try {
    await pool.query('select 1')
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '28P01') {
      throw new Error('PostgreSQL rejected the credentials in .env.postgres.local. An existing Docker volume keeps its original password. Restore the matching configuration or see the PostgreSQL recovery steps in README.md.')
    }
    throw error
  } finally {
    await pool.end()
  }
}
