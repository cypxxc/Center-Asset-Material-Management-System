const ADMIN_TABLES = [
  'profiles', 'categories', 'locations', 'units', 'items', 'audit_logs',
] as const

export type AdminTable = (typeof ADMIN_TABLES)[number]

export function assertAdminTable(
  value: string,
  operation: 'read' | 'write' | 'delete',
): AdminTable {
  void operation
  if (!(ADMIN_TABLES as readonly string[]).includes(value)) {
    throw new Error('Unsupported admin table')
  }
  return value as AdminTable
}
