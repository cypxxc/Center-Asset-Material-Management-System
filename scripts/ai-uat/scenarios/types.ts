export type UserRole = 'admin' | 'staff' | 'viewer'

export const USER_ROLES: readonly UserRole[] = ['admin', 'staff', 'viewer'] as const

export interface UATScenario {
  id: string
  role: UserRole
  title: string
  goal: string
  successCriteria: string[]
  maxSteps?: number
  exploratorySteps?: number
}

export interface AgentStepAction {
  stepNumber: number
  thought: string
  tool: string
  args: Record<string, unknown>
  screenshotPath?: string
  timestamp: string
}

export type DefectSeverity = 'Critical' | 'Major' | 'Minor'

export interface DefectFinding {
  severity: DefectSeverity
  title: string
  description: string
  screenshotPath?: string
}

export interface ScenarioResult {
  scenarioId: string
  role: UserRole
  status: 'PASS' | 'FAIL'
  durationMs: number
  summary: string
  steps: AgentStepAction[]
  defects: DefectFinding[]
}

export interface UATRunReport {
  timestamp: string
  totalDurationMs: number
  model: string
  results: ScenarioResult[]
  readinessScore: number
}
