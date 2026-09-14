import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { parseMcpCreateItem, parseMcpUpdateItem, parseMcpDeleteItem } from './mcp-policy'

class McpInputError extends Error {}
function json(value: unknown) {
  return JSON.stringify(value, (key, field) => typeof field === 'string' && ['unit_price', 'depreciation_cost', 'depreciation_residual_value'].includes(key) ? Number(field) : field, 2)
}
const listSchema = z.strictObject({
  q: z.string().max(500).optional(), status: z.string().max(100).optional(),
  item_type: z.enum(['asset', 'material']).optional(), category_id: z.uuid().optional(), location_id: z.uuid().optional(),
  limit: z.number().int().min(1).max(100).optional(),
})

export function createPostgresMcp(env: NodeJS.ProcessEnv) {
  const profileId = z.uuid().safeParse(env.MCP_POSTGRES_PROFILE_ID)
  if (!profileId.success) throw new Error('Set MCP_POSTGRES_PROFILE_ID to an explicit active profile UUID before starting PostgreSQL MCP.')
  if (!env.DATABASE_URL) throw new Error('Set DATABASE_URL to the restricted camms_app connection before starting PostgreSQL MCP.')
  const pool = new Pool({ connectionString: env.DATABASE_URL, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 1000, statement_timeout: 15000 })
  pool.on('error', () => console.error('PostgreSQL MCP connection failed'))
  const db = drizzle(pool)
  const writeEnabled = env.CAMMS_MCP_ALLOW_WRITE === 'true'
  return {
    writeEnabled,
    close: () => pool.end(),
    async execute(name: string, args: Record<string, unknown> = {}): Promise<string> {
      const writing = ['create_item', 'update_item', 'delete_item'].includes(name)
      if (writing && !writeEnabled) throw new McpInputError('MCP write tools are disabled')
      if (!['list_items', 'get_item', 'list_categories', 'list_locations', 'create_item', 'update_item', 'delete_item'].includes(name)) throw new McpInputError(`Tool not found: ${name}`)
      try {
        return await db.transaction(async tx => {
          const role = await tx.execute(sql`select current_user as database_role`)
          if (role.rows[0]?.database_role !== 'camms_app') throw new McpInputError('PostgreSQL MCP requires the restricted camms_app DATABASE_URL.')
          await tx.execute(sql`select set_config('app.user_id', ${profileId.data}, true)`)
          const actor = await tx.execute(sql`select role from public.profiles where id = ${profileId.data}::uuid and is_active for share`)
          if (!actor.rows.length) throw new McpInputError('The configured MCP profile is missing or inactive.')
          if (writing && !['admin', 'staff'].includes(String(actor.rows[0].role))) throw new McpInputError('The configured MCP profile cannot modify items.')
          if (name === 'list_categories' || name === 'list_locations') {
            z.strictObject({}).parse(args)
            const table = name === 'list_categories' ? sql`public.categories` : sql`public.locations`
            const result = await tx.execute(sql`select id,name from ${table} where is_active order by name`)
            return json(result.rows)
          }
          if (name === 'list_items' || name === 'get_item') {
            const filters: SQL[] = [sql`i.deleted_at is null`]
            let limit = 1
            if (name === 'get_item') {
              filters.push(sql`i.id = ${parseMcpDeleteItem(args).id}::uuid`)
            } else {
              const input = listSchema.parse(args)
              limit = input.limit ?? 25
              if (input.status) filters.push(sql`i.status = ${input.status}`)
              if (input.item_type) filters.push(sql`i.item_type = ${input.item_type}`)
              if (input.category_id) filters.push(sql`i.category_id = ${input.category_id}::uuid`)
              if (input.location_id) filters.push(sql`i.location_id = ${input.location_id}::uuid`)
              if (input.q) {
                const term = `%${input.q}%`
                filters.push(sql`(i.item_name ilike ${term} or i.asset_no ilike ${term} or i.serial_no ilike ${term})`)
              }
            }
            const result = await tx.execute(sql`select i.*, case when c.id is null then null else jsonb_build_object('name',c.name) end as category, case when l.id is null then null else jsonb_build_object('name',l.name) end as location from public.items i left join public.categories c on c.id=i.category_id left join public.locations l on l.id=i.location_id where ${sql.join(filters, sql` and `)} order by i.created_at desc,i.id limit ${limit}`)
            if (name === 'get_item' && !result.rows[0]) throw new McpInputError('Item not found')
            return json(name === 'get_item' ? result.rows[0] : result.rows)
          }
          if (name === 'delete_item') {
            const { id } = parseMcpDeleteItem(args)
            const result = await tx.execute(sql`update public.items set deleted_at=now(),deleted_by=${profileId.data}::uuid,updated_by=${profileId.data}::uuid where id=${id}::uuid and deleted_at is null returning *`)
            if (!result.rows[0]) throw new McpInputError('Item not found')
            return `Item deleted successfully:\n${json(result.rows[0])}`
          }
          const parsed = name === 'create_item' ? { id: null, updates: parseMcpCreateItem(args) } : parseMcpUpdateItem(args)
          // The strict shared schemas are the identifier allowlist for every write.
          const payload: Record<string, unknown> = { ...parsed.updates, updated_by: profileId.data }
          if (typeof payload.item_name === 'string' && !payload.item_name.trim()) throw new McpInputError('Item name is required')
          if (typeof payload.unit_price === 'number' && payload.unit_price < 0) throw new McpInputError('Unit price cannot be negative')
          if (name === 'create_item') payload.created_by = profileId.data
          const entries = Object.entries(payload).filter(([, value]) => value !== undefined)
          const result = name === 'create_item'
            ? await tx.execute(sql`insert into public.items (${sql.join(entries.map(([key]) => sql.identifier(key)), sql`, `)}) values (${sql.join(entries.map(([, value]) => sql`${value}`), sql`, `)}) returning *`)
            : await tx.execute(sql`update public.items set ${sql.join(entries.map(([key, value]) => sql`${sql.identifier(key)}=${value}`), sql`, `)} where id=${parsed.id}::uuid and deleted_at is null returning *`)
          if (!result.rows[0]) throw new McpInputError('Item not found')
          return `Item ${name === 'create_item' ? 'created' : 'updated'} successfully:\n${json(result.rows[0])}`
        })
      } catch (error) {
        if (error instanceof McpInputError) throw error
        if (error instanceof z.ZodError) throw new McpInputError('Invalid MCP tool arguments')
        throw new Error('PostgreSQL MCP operation failed. Check the connection, profile permissions and supplied references.')
      }
    },
  }
}
