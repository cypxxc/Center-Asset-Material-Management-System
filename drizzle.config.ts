import { defineConfig } from 'drizzle-kit'

// Generation only. Apply migrations through the guarded npm run db:migrate command.
export default defineConfig({ dialect: 'postgresql', schema: './db/postgres/schema.ts', out: './db/postgres/migrations', strict: true })
