import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { measureQuery } from '@/lib/performance'
import { readDevelopmentSessionUser } from '@/features/auth/dev-auth'
import { config } from '@/lib/config'
import { withDeadline } from '@/lib/deadline'

function unavailableResponse() {
  return new NextResponse('<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>บริการขัดข้องชั่วคราว</title><body><main><h1>บริการขัดข้องชั่วคราว</h1><p>ระบบไม่สามารถตรวจสอบการเข้าสู่ระบบได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง</p><p><a href="">ลองใหม่</a></p></main></body></html>', {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Retry-After': '15' },
  })
}

const STATIC_ASSET_PREFIXES = ['/assets/', '/fonts/', '/icons/', '/images/']
const STATIC_ASSET_EXTENSION = /\.(?:avif|css|gif|ico|jpe?g|js|map|otf|png|svg|ttf|webp|woff2?)$/i
const ROOT_PUBLIC_FILES = new Set(['/manifest.webmanifest', '/robots.txt', '/sitemap.xml'])

function isKnownStaticAssetPath(pathname: string) {
  return ROOT_PUBLIC_FILES.has(pathname)
    || (
      STATIC_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))
      && STATIC_ASSET_EXTENSION.test(pathname)
    )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const pathname = request.nextUrl.pathname

  // Exclude assets, public files, and api routes from auth checks immediately
  // to avoid establishing Supabase clients and making auth getUser network calls
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    isKnownStaticAssetPath(pathname)
  ) {
    return supabaseResponse
  }

  const controller = new AbortController()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => {
          const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
          const signal = callerSignal
            ? AbortSignal.any([callerSignal, controller.signal])
            : controller.signal
          signal.throwIfAborted()
          return fetch(input, { ...init, signal })
        },
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          if (controller.signal.aborted) return
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([name, value]) => supabaseResponse.headers.set(name, value))
        },
      },
    }
  )

  const devSessionUser = readDevelopmentSessionUser(request.cookies as unknown as import('@/features/auth/dev-auth').CookieStoreLike)
  let user: { id: string; email?: string } | null = devSessionUser
  if (!user) {
    try {
      const { result: { data, error } } = await measureQuery(
        'proxy.auth.getClaims',
        () => withDeadline(() => supabase.auth.getClaims(), config.limits.supabaseAuthTimeoutMs, controller),
      )
      if (error && (error.name === 'AuthRetryableFetchError' || (error.status ?? 0) >= 500)) {
        return unavailableResponse()
      }
      // The SDK verifies the signature and expiry, refreshing expired sessions.
      // Server guards still load the current user and active profile through RLS.
      user = !error && typeof data?.claims?.sub === 'string' && data.claims.sub.length > 0
        ? { id: data.claims.sub }
        : null
      // A signed access token can outlive its session. Check the same Auth
      // authority as server guards before redirecting away from the login form.
      if (user && pathname === '/login') {
        const { data: current, error: currentError } = await withDeadline(
          () => supabase.auth.getUser(), config.limits.supabaseAuthTimeoutMs, controller,
        )
        if (currentError && (currentError.name === 'AuthRetryableFetchError' || (currentError.status ?? 0) >= 500)) {
          return unavailableResponse()
        }
        user = currentError ? null : current.user
      }
    } catch {
      // Fail closed and preserve the browser session during temporary Auth outages.
      controller.abort()
      return unavailableResponse()
    }
  }

  // Auth page routing
  const isLoginPage = pathname === '/login'
  const isInactiveNotice = isLoginPage && request.nextUrl.searchParams.get('error') === 'inactive'

  function redirectWithSession(url: URL) {
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
    for (const name of ['cache-control', 'expires', 'pragma']) {
      const value = supabaseResponse.headers.get(name)
      if (value) response.headers.set(name, value)
    }
    return response
  }

  if (!user) {
    // If not logged in and trying to access protected page
    if (!isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return redirectWithSession(url)
    }
  } else if (isLoginPage && !isInactiveNotice) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return redirectWithSession(url)
  }

  return supabaseResponse
}
