import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'
config({ path: '.env.postgres.app', quiet: true })
export default defineConfig({ dialect: 'postgresql', schema: './db/postgres/schema.ts', out: './db/postgres/migrations', dbCredentials: { url: process.env.DATABASE_MIGRATION_URL ?? '' }, strict: true })
