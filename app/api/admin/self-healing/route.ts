import { NextResponse } from 'next/server'
import { getCurrentProfile } from '@/features/auth/queries'
import { runDiagnostics } from '@/lib/self-healing/scanner'
import { healIssues, HealingResult } from '@/lib/self-healing/healer'
import { DiagnosticReport } from '@/lib/self-healing/types'

const responseHeaders = { 'Cache-Control': 'private, no-store' }

export interface ApiDependencies {
  getProfile?: () => Promise<{ id: string; role: string; is_active: boolean } | null>
  runDiag?: () => Promise<DiagnosticReport>
  runHeal?: (issues: DiagnosticReport['issues']) => Promise<HealingResult[]>
}

export async function handleGetSelfHealing(deps: ApiDependencies = {}) {
  const getProfile = deps.getProfile ?? getCurrentProfile
  const runDiag = deps.runDiag ?? runDiagnostics

  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: responseHeaders })
  }
  if (!profile.is_active || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin role required' }, { status: 403, headers: responseHeaders })
  }

  const report = await runDiag()
  return NextResponse.json(report, { headers: responseHeaders })
}

export async function handlePostSelfHealing(deps: ApiDependencies = {}) {
  const getProfile = deps.getProfile ?? getCurrentProfile
  const runDiag = deps.runDiag ?? runDiagnostics
  const runHeal = deps.runHeal ?? healIssues

  const profile = await getProfile()
  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: responseHeaders })
  }
  if (!profile.is_active || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin role required' }, { status: 403, headers: responseHeaders })
  }

  const report = await runDiag()
  const results = await runHeal(report.issues)
  const healedCount = results.filter((r) => r.status === 'SUCCESS').length

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    initialHealthScore: report.healthScore,
    healedCount,
    results,
  }, { headers: responseHeaders })
}

export async function GET() {
  return handleGetSelfHealing()
}

export async function POST() {
  return handlePostSelfHealing()
}
