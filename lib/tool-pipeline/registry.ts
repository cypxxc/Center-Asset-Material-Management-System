import { type ToolDefinition, type ToolExecutionContext, type ToolPipelineResult } from './types'
import { runToolPipeline } from './pipeline'

export class ToolRegistry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private tools = new Map<string, ToolDefinition<any, any>>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(tool: ToolDefinition<any, any>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered in ToolRegistry`)
    }
    this.tools.set(tool.name, tool)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(name: string): ToolDefinition<any, any> | undefined {
    return this.tools.get(name)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list(): ToolDefinition<any, any>[] {
    return Array.from(this.tools.values())
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAll(): ToolDefinition<any, any>[] {
    return this.list()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listByCategory(category: ToolDefinition['category']): ToolDefinition<any, any>[] {
    return this.list().filter((t) => t.category === category)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getByCategory(category: ToolDefinition['category']): ToolDefinition<any, any>[] {
    return this.listByCategory(category)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listForRole(role?: 'admin' | 'staff' | 'viewer'): ToolDefinition<any, any>[] {
    return this.list().filter((tool) => {
      if (!tool.requiredRole || tool.requiredRole === 'public') return true
      if (role === 'admin') return true
      if (role === 'staff' && (tool.requiredRole === 'staff' || tool.requiredRole === 'viewer')) {
        return true
      }
      if (role === 'viewer' && tool.requiredRole === 'viewer') {
        return true
      }
      return false
    })
  }

  async execute(
    name: string,
    rawInput: unknown,
    context: ToolExecutionContext
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<ToolPipelineResult<any>> {
    const tool = this.get(name)
    if (!tool) {
      return {
        success: false,
        error: {
          code: 'TOOL_EXECUTION_ERROR',
          message: `Tool '${name}' not found in registry`,
          remediationHint: `Available tools: ${this.list().map((t) => t.name).join(', ')}`,
        },
        durationMs: 0,
      }
    }

    return runToolPipeline(tool, rawInput, context)
  }

  getOpenApiToolsDeclaration(): Array<{
    name: string
    description: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputSchema: any
  }> {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }))
  }
}

// Global Singleton Registry
let globalRegistry: ToolRegistry | null = null

export function getGlobalToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry()
  }
  return globalRegistry
}

export const globalToolRegistry = getGlobalToolRegistry()
