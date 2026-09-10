import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import ws from 'ws'
import { instrumentSupabaseFetch } from './transport'

const instrumentedFetch = instrumentSupabaseFetch()

type WritableCookieStore = {
  set(name: string, value: string, options?: Record<string, unknown>): void
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: instrumentedFetch },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              (cookieStore as unknown as WritableCookieStore).set(name, value, options)
            )
          } catch {
            // Can be ignored if middleware handles session refreshing
          }
        },
      },
    }
  )
}

export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: { fetch: instrumentedFetch },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      db: {
        schema: 'public',
      },
      realtime: {
        transport: ws as unknown as typeof WebSocket,
      },
    }
  )
}
