
export function isAdmin(role?: string | null): boolean {
  return role === 'admin';
}

export function isStaff(role?: string | null): boolean {
  return role === 'staff';
}

export function isViewer(role?: string | null): boolean {
  return role === 'viewer';
}

export function canWrite(role?: string | null): boolean {
  return role === 'admin' || role === 'staff';
}

export function canDelete(role?: string | null): boolean {
  // Admin and Staff are allowed to perform delete
  return role === 'admin' || role === 'staff';
}

export function canManageSettings(role?: string | null): boolean {
  return role === 'admin' || role === 'staff';
}

export function canManageTrash(role?: string | null): boolean {
  return role === 'admin' || role === 'staff';
}
