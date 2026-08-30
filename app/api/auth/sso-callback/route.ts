import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * SSO and external account provisioning are deferred for the standalone release.
 * Keep the former callback path inert so previously distributed links cannot invoke
 * any authentication, service-role, user-provisioning, or profile-reactivation work.
 */
export function GET() {
  return new NextResponse(null, { status: 404 })
}
