import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { measureQuery } from '@/lib/performance'
import { readDevelopmentSessionUser } from '@/features/auth/dev-auth'

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
    pathname.includes('.')
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

  // Auth pages & public item scan logic
  const isLoginPage = pathname === '/login'
  const isInactiveNotice = isLoginPage && request.nextUrl.searchParams.get('error') === 'inactive'
  const isPublicItemPage = pathname.startsWith('/items/') && pathname !== '/items/new' && !pathname.endsWith('/edit')

  if (!user) {
    // If not logged in and trying to access protected page
    if (!isLoginPage && !isPublicItemPage) {
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
