import { z } from 'zod'
import { defineTool } from '../pipeline'

export const itemGetTool = defineTool({
  name: 'items_get',
  description: 'Retrieve an item record by its UUID or asset code',
  category: 'inventory',
  requiredRole: 'viewer',
  rateLimitTier: 'read',
  inputSchema: z.object({
    idOrCode: z.string().min(1, 'Item ID or Code is required').max(100),
  }),
  outputSchema: z.object({
    id: z.string(),
    code: z.string().nullable().optional(),
    name: z.string(),
    type: z.enum(['asset', 'supply']),
    quantity: z.number(),
  }),
  handler: async (input) => {
    return {
      id: input.idOrCode,
      code: input.idOrCode,
      name: 'Sample Item',
      type: 'asset' as const,
      quantity: 1,
    }
  },
})

export const itemListTool = defineTool({
  name: 'items_list',
  description: 'List inventory items with optional pagination and filters',
  category: 'inventory',
  requiredRole: 'viewer',
  rateLimitTier: 'read',
  inputSchema: z.object({
    limit: z.number().int().min(1).max(100).default(20),
    offset: z.number().int().min(0).default(0),
    status: z.enum(['active', 'archived', 'all']).default('active'),
  }),
  outputSchema: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        quantity: z.number(),
      })
    ),
    totalCount: z.number(),
  }),
  handler: async () => {
    return {
      items: [
        {
          id: 'item-1',
          name: 'Office Desk',
          type: 'asset',
          quantity: 5,
        },
      ],
      totalCount: 1,
    }
  },
})

export const itemCreateTool = defineTool({
  name: 'items_create',
  description: 'Create a new inventory item with strict boundaries',
  category: 'inventory',
  requiredRole: 'staff',
  rateLimitTier: 'mutation',
  inputSchema: z.object({
    item_name: z.string().min(1, 'item_name is required').max(255),
    item_type: z.enum(['asset', 'supply']),
    category_id: z.string().min(1, 'category_id is required'),
    quantity: z.number().int().min(1).default(1),
    unit_price: z.number().nonnegative().optional(),
    location_id: z.string().optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    itemId: z.string(),
    name: z.string(),
  }),
  handler: async (input) => {
    return {
      success: true,
      itemId: `gen-${Date.now()}`,
      name: input.item_name,
    }
  },
})
