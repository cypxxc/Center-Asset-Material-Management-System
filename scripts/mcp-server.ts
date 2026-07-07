import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// 1. Load env variables from .env.local
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Use Service Role Key if available (bypasses RLS), fallback to Anon Key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase environment variables not configured in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

// 2. Setup Stdio JSON-RPC 2.0 interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    if (request.jsonrpc !== '2.0') return;

    const response = await handleRequest(request);
    if (response) {
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  } catch {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      }) + '\n'
    );
  }
});

async function handleRequest(request: { id?: string | number | null; method: string; params?: Record<string, unknown> }) {
  const { id, method, params } = request;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'camms-mcp-server',
          version: '1.0.0',
        },
      },
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: 'list_items',
            description: 'List items in the CAMMS registry with pagination and filters',
            inputSchema: {
              type: 'object',
              properties: {
                q: { type: 'string', description: 'Keyword search for item name, asset number, or serial number' },
                status: {
                  type: 'string',
                  description: 'Filter by status: active, spare, damaged, waiting_repair, inactive, disposed',
                },
                item_type: { type: 'string', description: 'Filter by type: asset, material' },
                category_id: { type: 'string', description: 'Filter by category UUID' },
                location_id: { type: 'string', description: 'Filter by location UUID' },
                limit: { type: 'number', description: 'Max items to return (default 25, max 100)' },
              },
            },
          },
          {
            name: 'get_item',
            description: 'Get detailed details of a specific item by ID',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Item UUID' },
              },
              required: ['id'],
            },
          },
          {
            name: 'create_item',
            description: 'Create a new item in the CAMMS registry',
            inputSchema: {
              type: 'object',
              properties: {
                item_name: { type: 'string', description: 'Name of the item' },
                item_type: { type: 'string', enum: ['asset', 'material'] },
                unit_price: { type: 'number', description: 'Unit price used for inventory valuation' },
                category_id: { type: 'string', description: 'Category UUID' },
                quantity: { type: 'number', description: 'Quantity (must be >= 1)' },
                unit_id: { type: 'string', description: 'Unit UUID' },
                asset_no: { type: 'string', description: 'Asset inventory number' },
                serial_no: { type: 'string', description: 'Serial number' },
                brand: { type: 'string', description: 'Brand name' },
                model: { type: 'string', description: 'Model name' },
                location_id: { type: 'string', description: 'Location UUID' },
                responsible_person: { type: 'string', description: 'Responsible person name' },
                status: { type: 'string', description: 'Status' },
                note: { type: 'string', description: 'Additional note' },
              },
              required: ['item_name', 'item_type', 'quantity'],
            },
          },
          {
            name: 'update_item',
            description: 'Update properties of an existing item in the registry',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Item UUID' },
                updates: {
                  type: 'object',
                  properties: {
                    item_name: { type: 'string' },
                    item_type: { type: 'string', enum: ['asset', 'material'] },
                    unit_price: { type: 'number' },
                    category_id: { type: 'string' },
                    quantity: { type: 'number' },
                    unit_id: { type: 'string' },
                    asset_no: { type: 'string' },
                    serial_no: { type: 'string' },
                    brand: { type: 'string' },
                    model: { type: 'string' },
                    location_id: { type: 'string' },
                    responsible_person: { type: 'string' },
                    status: { type: 'string' },
                    note: { type: 'string' },
                  },
                },
              },
              required: ['id', 'updates'],
            },
          },
          {
            name: 'delete_item',
            description: 'Soft-delete an item from the registry by setting deleted_at',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Item UUID' },
              },
              required: ['id'],
            },
          },
          {
            name: 'list_categories',
            description: 'List all active categories in CAMMS',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'list_locations',
            description: 'List all active office locations in CAMMS',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      },
    };
  }

  if (method === 'tools/call') {
    const callParams = params as { name?: string; arguments?: McpToolArguments } | undefined;
    const name = callParams?.name || '';
    const args = callParams?.arguments;
    try {
      const resultText = await executeTool(name, args);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
        },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Internal tool execution error';
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: errorMessage,
        },
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

interface McpToolArguments {
  id?: string;
  limit?: number;
  q?: string;
  status?: string;
  item_type?: string;
  category_id?: string;
  location_id?: string;
  updates?: Record<string, unknown>;
  [key: string]: unknown;
}

async function executeTool(name: string, args: McpToolArguments | undefined): Promise<string> {
  switch (name) {
    case 'list_items': {
      const limit = Math.min(100, Math.max(1, args?.limit || 25));
      let query = supabase
        .from('items')
        .select('*, category:categories(name), location:locations(name)')
        .is('deleted_at', null)
        .limit(limit)
        .order('created_at', { ascending: false });

      if (args?.status) query = query.eq('status', args.status);
      if (args?.item_type) query = query.eq('item_type', args.item_type);
      if (args?.category_id) query = query.eq('category_id', args.category_id);
      if (args?.location_id) query = query.eq('location_id', args.location_id);

      if (args?.q) {
        const keyword = `%${args.q}%`;
        query = query.or(`item_name.ilike.${keyword},asset_no.ilike.${keyword},serial_no.ilike.${keyword}`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return JSON.stringify(data || [], null, 2);
    }

    case 'get_item': {
      const id = args?.id;
      if (!id) throw new Error('Item ID is required');
      const { data, error } = await supabase
        .from('items')
        .select('*, category:categories(name), location:locations(name)')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error) throw new Error(error.message);
      return JSON.stringify(data, null, 2);
    }

    case 'create_item': {
      if (!args) throw new Error('Arguments are required to create an item');
      const { data, error } = await supabase
        .from('items')
        .insert({
          ...args,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return `Item created successfully:\n${JSON.stringify(data, null, 2)}`;
    }

    case 'update_item': {
      const id = args?.id;
      const updates = args?.updates;
      if (!id || !updates) throw new Error('Item ID and updates are required');
      const { data, error } = await supabase
        .from('items')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return `Item updated successfully:\n${JSON.stringify(data, null, 2)}`;
    }

    case 'delete_item': {
      const id = args?.id;
      if (!id) throw new Error('Item ID is required');
      const { data, error } = await supabase
        .from('items')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return `Item deleted successfully:\n${JSON.stringify(data, null, 2)}`;
    }

    case 'list_categories': {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw new Error(error.message);
      return JSON.stringify(data || [], null, 2);
    }

    case 'list_locations': {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw new Error(error.message);
      return JSON.stringify(data || [], null, 2);
    }

    default:
      throw new Error(`Tool not found: ${name}`);
  }
}
