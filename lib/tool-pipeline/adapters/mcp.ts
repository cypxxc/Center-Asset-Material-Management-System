import { type ToolRegistry } from '../registry'
import { type ToolExecutionContext } from '../types'

export interface McpContentItem {
  type: 'text'
  text: string
}

export interface McpToolCallResult {
  content: McpContentItem[]
  isError?: boolean
}

export interface McpToolDeclaration {
  name: string
  description: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputSchema: any
}

export interface McpAdapter {
  handleToolsList: (role?: 'admin' | 'staff' | 'viewer') => { tools: McpToolDeclaration[] }
  handleToolsCall: (
    name: string,
    args: unknown,
    context: ToolExecutionContext
  ) => Promise<McpToolCallResult>
}

export function createMcpAdapter(registry: ToolRegistry): McpAdapter {
  return {
    handleToolsList: (role?: 'admin' | 'staff' | 'viewer') => {
      const tools = registry.listForRole(role).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }))
      return { tools }
    },

    handleToolsCall: async (
      name: string,
      args: unknown,
      context: ToolExecutionContext
    ): Promise<McpToolCallResult> => {
      const result = await registry.execute(name, args, context)

      if (result.success) {
        return {
          content: [
            {
              type: 'text',
              text:
                typeof result.data === 'string'
                  ? result.data
                  : JSON.stringify(result.data, null, 2),
            },
          ],
          isError: false,
        }
      }

      const errorText = [
        `Error [${result.error.code}]: ${result.error.message}`,
        `Remediation: ${result.error.remediationHint}`,
        result.error.fieldErrors
          ? `Field Errors: ${JSON.stringify(result.error.fieldErrors, null, 2)}`
          : null,
      ]
        .filter(Boolean)
        .join('\n')

      return {
        content: [
          {
            type: 'text',
            text: errorText,
          },
        ],
        isError: true,
      }
    },
  }
}
