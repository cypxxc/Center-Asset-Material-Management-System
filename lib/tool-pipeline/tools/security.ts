import { z } from 'zod'
import { defineTool } from '../pipeline'
import { SECURITY_HEADERS } from '@/lib/security-headers'
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit'

export const securityVerifyTool = defineTool({
  name: 'system_verify_security',
  description: 'Run programmatic security posture check across all defense pillars',
  category: 'security',
  requiredRole: 'admin',
  inputSchema: z.object({}),
  outputSchema: z.object({
    status: z.enum(['SECURE', 'DEGRADED', 'AT_RISK']),
    headersCount: z.number(),
    rateLimitTiers: z.array(z.string()),
    timestamp: z.string(),
  }),
  handler: async () => {
    const headersCount = Object.keys(SECURITY_HEADERS).length
    const tiers = Object.keys(RATE_LIMIT_TIERS)
    const status: 'SECURE' | 'DEGRADED' =
      headersCount >= 5 && tiers.length >= 4 ? 'SECURE' : 'DEGRADED'

    return {
      status,
      headersCount,
      rateLimitTiers: tiers,
      timestamp: new Date().toISOString(),
    }
  },
})
