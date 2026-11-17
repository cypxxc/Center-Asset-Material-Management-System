import type { UserRole, UATScenario } from './types'
import { ADMIN_SCENARIOS } from './admin.scenarios'
import { STAFF_SCENARIOS } from './staff.scenarios'
import { VIEWER_SCENARIOS } from './viewer.scenarios'

export { ADMIN_SCENARIOS } from './admin.scenarios'
export { STAFF_SCENARIOS } from './staff.scenarios'
export { VIEWER_SCENARIOS } from './viewer.scenarios'
export * from './types'

export function getAllScenarios(roleFilter?: UserRole): UATScenario[] {
  const all: UATScenario[] = [
    ...ADMIN_SCENARIOS,
    ...STAFF_SCENARIOS,
    ...VIEWER_SCENARIOS,
  ]

  if (!roleFilter) {
    return all
  }

  return all.filter(s => s.role === roleFilter)
}
