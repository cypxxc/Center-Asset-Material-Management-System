import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { measureQuery } from '@/lib/performance'
import { readDevelopmentSessionUser } from '@/features/auth/dev-auth'

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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const devSessionUser = readDevelopmentSessionUser(request.cookies as unknown as import('@/features/auth/dev-auth').CookieStoreLike)
  const user = devSessionUser
    ? ({ id: devSessionUser.id, email: devSessionUser.email } as { id: string; email: string })
    : (
        await measureQuery('proxy.auth.getUser', () => supabase.auth.getUser())
      ).result.data.user

  // Auth page routing
  const isLoginPage = pathname === '/login'
  const isInactiveNotice = isLoginPage && request.nextUrl.searchParams.get('error') === 'inactive'

  if (!user) {
    // If not logged in and trying to access protected page
    if (!isLoginPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  } else if (isLoginPage && !isInactiveNotice) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
