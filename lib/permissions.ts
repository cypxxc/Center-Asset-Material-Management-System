export function isAdmin(role?: string | null): boolean {
  return role === 'admin';
}

export function canWrite(role?: string | null): boolean {
  return role === 'admin';
}

export function canDelete(role?: string | null): boolean {
  return role === 'admin';
}

export function canManageSettings(role?: string | null): boolean {
  return role === 'admin';
}

export function canCreateDisbursement(role?: string | null): boolean {
  return role === 'admin' || role === 'user';
}
