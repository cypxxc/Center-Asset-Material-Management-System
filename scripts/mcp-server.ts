import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline'
import { createPostgresMcp } from './mcp-postgres'

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
}
loadEnv()

const postgres = createPostgresMcp(process.env)
const tools = [
  { name: 'list_items', description: 'List registry items', inputSchema: { type: 'object', properties: { q: { type: 'string' }, status: { type: 'string' }, item_type: { type: 'string', enum: ['asset', 'material'] }, category_id: { type: 'string' }, location_id: { type: 'string' }, limit: { type: 'number' } } } },
  { name: 'get_item', description: 'Get a registry item by UUID', inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'], additionalProperties: false } },
  { name: 'list_categories', description: 'List active categories', inputSchema: { type: 'object', properties: {} } },
  { name: 'list_locations', description: 'List active locations', inputSchema: { type: 'object', properties: {} } },
  { name: 'create_item', description: 'Create a registry item (writes require CAMMS_MCP_ALLOW_WRITE=true)', inputSchema: { type: 'object' } },
  { name: 'update_item', description: 'Update a registry item (writes require CAMMS_MCP_ALLOW_WRITE=true)', inputSchema: { type: 'object' } },
  { name: 'delete_item', description: 'Soft-delete a registry item (writes require CAMMS_MCP_ALLOW_WRITE=true)', inputSchema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'], additionalProperties: false } },
  { name: 'diagnose_system_health', description: 'Run registry diagnostics', inputSchema: { type: 'object', properties: {} } },
  { name: 'heal_system_issues', description: 'Heal selected auto-healable issues', inputSchema: { type: 'object', properties: { issue_codes: { type: 'array', items: { type: 'string' } } } } },
]

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false })
rl.on('close', () => { void postgres.close() })
rl.on('line', async (line) => {
  let request: { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }
  try { request = JSON.parse(line) } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n'); return }
  if (request.jsonrpc !== '2.0' || request.id === undefined) return
  try {
    let result: unknown
    if (request.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'camms-postgres', version: '1.0.0' } }
    else if (request.method === 'tools/list') {
      const writeToolNames = new Set(['create_item', 'update_item', 'delete_item', 'heal_system_issues'])
      result = { tools: postgres.writeEnabled ? tools : tools.filter(t => !writeToolNames.has(t.name)) }
    }
    else if (request.method === 'tools/call') {
      const params = request.params as { name?: string; arguments?: Record<string, unknown> } | undefined
      const name = params?.name ?? ''
      const args = params?.arguments ?? {}
      let output: string
      if (name === 'diagnose_system_health') output = JSON.stringify(await (await import('../lib/self-healing/scanner')).runDiagnostics(), null, 2)
      else if (name === 'heal_system_issues') {
        if (!postgres.writeEnabled) throw new Error('MCP write tools are disabled')
        const report = await (await import('../lib/self-healing/scanner')).runDiagnostics()
        const codes = Array.isArray(args.issue_codes) ? args.issue_codes : []
        output = JSON.stringify(await (await import('../lib/self-healing/healer')).healIssues(codes.length ? report.issues.filter(issue => codes.includes(issue.code)) : report.issues), null, 2)
      } else output = await postgres.execute(name, args)
      result = { content: [{ type: 'text', text: output }] }
    } else throw Object.assign(new Error(`Method not found: ${request.method}`), { code: -32601 })
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n')
  } catch (error) {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: (error as { code?: number }).code ?? -32603, message: error instanceof Error ? error.message : 'Internal error' } }) + '\n')
  }
})
