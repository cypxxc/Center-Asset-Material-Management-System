import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import path from 'node:path'

interface JsonRpcResponse {
  id: number
  result?: { tools?: Array<{ name: string }> }
  error?: { code: number; message: string }
}

async function runMcp(requests: unknown[], allowWrite: boolean): Promise<JsonRpcResponse[]> {
  const child = spawn(process.execPath, ['--import', 'tsx', path.join(process.cwd(), 'scripts/mcp-server.ts')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      CAMMS_MCP_ALLOW_WRITE: allowWrite ? 'true' : 'false',
      SUPABASE_SERVICE_ROLE_KEY: allowWrite ? 'test-service-role-key' : '',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk })
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk })
  for (const request of requests) child.stdin.write(`${JSON.stringify(request)}\n`)
  child.stdin.end()

  const [code] = await once(child, 'exit') as [number | null]
  assert.equal(code, 0, stderr)
  return stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as JsonRpcResponse)
}

test('MCP stdio exposes write tools only when enabled and rejects disabled write calls', async () => {
  const listRequest = { jsonrpc: '2.0', id: 1, method: 'tools/list' }
  const disabled = await runMcp([
    listRequest,
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: {
      name: 'create_item', arguments: { item_name: 'Desk', item_type: 'asset', quantity: 1 },
    } },
  ], false)
  const enabled = await runMcp([listRequest], true)

  const disabledNames = disabled[0].result?.tools?.map((tool) => tool.name) ?? []
  const enabledNames = enabled[0].result?.tools?.map((tool) => tool.name) ?? []
  assert.equal(disabledNames.includes('create_item'), false)
  assert.equal(disabledNames.includes('list_items'), true)
  assert.equal(enabledNames.includes('create_item'), true)
  assert.equal(enabledNames.includes('update_item'), true)
  assert.equal(enabledNames.includes('delete_item'), true)
  assert.deepEqual(disabled[1].error, { code: -32603, message: 'MCP write tools are disabled' })
})
