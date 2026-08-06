export function isAdmin(role?: string | null): boolean {
  return role === 'admin';
}

export function canWrite(role?: string | null): boolean {
  return role === 'admin' || role === 'staff';
}

export function canDelete(role?: string | null): boolean {
  return role === 'admin' || role === 'staff';
}

export function canManageSettings(role?: string | null): boolean {
  return role === 'admin' || role === 'staff';
}

export function canManageTrash(role?: string | null): boolean {
  return role === 'admin' || role === 'staff';
}
