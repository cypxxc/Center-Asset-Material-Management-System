/** Supabase Auth requires an email; admin-created accounts may use this placeholder domain. */
const INTERNAL_EMAIL_DOMAIN = '@registry.internal'

export function isInternalEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(INTERNAL_EMAIL_DOMAIN)
}

/** Generates a safe internal email placeholder for accounts created without an email. */
export function generateInternalEmail(): string {
  const shortId = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
  return `internal+${shortId}${INTERNAL_EMAIL_DOMAIN}`
}

/** User-facing label for profile and admin lists. */
export function formatDisplayEmail(email: string): string {
  if (isInternalEmail(email)) {
    return 'บัญชีภายใน (ไม่มีอีเมล)'
  }
  return email.trim()
}

/** Hint shown under internal accounts in the profile page. */
export function getInternalAccountHint(): string {
  return 'เข้าสู่ระบบด้วยชื่อ-นามสกุล หรือรหัส UUID ที่ผู้ดูแลระบบแจ้งให้'
}
