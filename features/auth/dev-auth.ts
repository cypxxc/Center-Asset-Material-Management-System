import { cookies } from 'next/headers'

export const DEVELOPMENT_AUTH_COOKIE_NAME = 'registry-dev-auth'

export type DevelopmentSeedAccount = {
  email: string
  password: string
  role: 'admin' | 'staff' | 'viewer'
}

export type DevelopmentSessionUser = {
  id: string
  email: string
  role: 'admin' | 'staff' | 'viewer'
  full_name?: string | null
}

export type CookieStoreLike = {
  get(name: string): { name?: string; value: string } | undefined
  set?: (name: string, value: string, options?: Record<string, unknown>) => void
  delete?: (name: string, options?: Record<string, unknown>) => void
}

const DEVELOPMENT_SEED_ACCOUNTS: DevelopmentSeedAccount[] = [
  { email: 'admin@registry.s', password: 'admin1234', role: 'admin' },
  { email: 'staff@registry.s', password: 'staff1234', role: 'staff' },
  { email: 'viewer@registry.s', password: 'viewer1234', role: 'viewer' },
]

const DEVELOPMENT_SESSION_MEMORY = new Map<string, DevelopmentSessionUser>()
const DEVELOPMENT_SESSION_MEMORY_KEY = 'current'

export function isDevelopmentAuthEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV !== 'production'
}

function getDevelopmentSessionUserFromMemory(): DevelopmentSessionUser | null {
  return DEVELOPMENT_SESSION_MEMORY.get(DEVELOPMENT_SESSION_MEMORY_KEY) ?? null
}

function setDevelopmentSessionUserInMemory(user: DevelopmentSessionUser) {
  DEVELOPMENT_SESSION_MEMORY.set(DEVELOPMENT_SESSION_MEMORY_KEY, user)
}

function clearDevelopmentSessionUserInMemory() {
  DEVELOPMENT_SESSION_MEMORY.delete(DEVELOPMENT_SESSION_MEMORY_KEY)
}

export function getDevelopmentSeedAccount(email: string, password: string) {
  if (!isDevelopmentAuthEnabled()) return null

  const normalizedEmail = email.trim().toLowerCase()
  return DEVELOPMENT_SEED_ACCOUNTS.find(
    (account) => account.email === normalizedEmail && account.password === password
  ) ?? null
}

export function readDevelopmentSessionUser(cookieStore?: CookieStoreLike | null): DevelopmentSessionUser | null {
  if (!isDevelopmentAuthEnabled()) return null

  const rawValue = cookieStore?.get(DEVELOPMENT_AUTH_COOKIE_NAME)?.value
  if (rawValue) {
    try {
      const parsed = JSON.parse(rawValue) as Partial<DevelopmentSessionUser>
      if (parsed.id && parsed.email) {
        return {
          id: parsed.id,
          email: parsed.email,
          role: parsed.role ?? 'viewer',
          full_name: parsed.full_name ?? null,
        }
      }
    } catch {
      // fall through to memory fallback
    }
  }

  return getDevelopmentSessionUserFromMemory()
}

export async function getDevelopmentSessionUser(cookieStore?: CookieStoreLike | null) {
  if (cookieStore) return readDevelopmentSessionUser(cookieStore)

  try {
    const store = await cookies()
    return readDevelopmentSessionUser(store as unknown as CookieStoreLike)
  } catch {
    return getDevelopmentSessionUserFromMemory()
  }
}

export async function setDevelopmentSessionUser(user: DevelopmentSessionUser, cookieStore?: CookieStoreLike | null) {
  if (!isDevelopmentAuthEnabled()) return

  setDevelopmentSessionUserInMemory(user)

  try {
    const store = cookieStore ?? (await cookies())
    const mutableStore = store as unknown as CookieStoreLike
    mutableStore.set?.(DEVELOPMENT_AUTH_COOKIE_NAME, JSON.stringify(user), {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    })
  } catch {
    // fall back to memory-only session when request scope is unavailable
  }
}

export async function clearDevelopmentSessionUser(cookieStore?: CookieStoreLike | null) {
  clearDevelopmentSessionUserInMemory()

  try {
    const store = cookieStore ?? (await cookies())
    const mutableStore = store as unknown as CookieStoreLike
    mutableStore.delete?.(DEVELOPMENT_AUTH_COOKIE_NAME, { path: '/' })
  } catch {
    // ignore when request scope is unavailable
  }
}
