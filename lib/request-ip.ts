import { isIP } from 'node:net'

type HeaderReader = { get(name: string): string | null }

export function normalizeIp(raw: string): string | null {
  const value = raw.trim()
  if (value.includes('%')) return null
  const version = isIP(value)
  if (version === 4) return value
  if (version !== 6) return null
  const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1)
  const mapped = normalized.match(/^::ffff:([a-f0-9]+):([a-f0-9]+)$/)
  if (mapped) {
    const high = parseInt(mapped[1], 16)
    const low = parseInt(mapped[2], 16)
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
  }
  return normalized
}

/** Trust is a deployment setting, never a property supplied by the requester. */
export function getTrustedClientIp(headers: HeaderReader, env: Record<string, string | undefined> = process.env): string {
  const mode = env.TRUSTED_PROXY_MODE ?? (env.VERCEL === '1' ? 'vercel' : 'none')
  if (mode === 'none') return 'unknown'
  const raw = headers.get('x-forwarded-for')
  if (!raw || raw.length > 2048) throw new Error('Trusted client IP is unavailable')
  let candidate: string
  if (mode === 'vercel') {
    if (env.VERCEL !== '1' || raw.includes(',')) throw new Error('Invalid Vercel ingress')
    // Vercel overwrites X-Forwarded-For; do not enable this for arbitrary proxies.
    candidate = raw
  } else if (mode === 'forwarded') {
    const hops = Number(env.TRUSTED_PROXY_HOPS)
    if (!Number.isSafeInteger(hops) || hops < 1 || hops > 16) throw new Error('Invalid trusted proxy hop count')
    const chain = raw.split(',')
    if (chain.length < hops) throw new Error('Incomplete trusted proxy chain')
    candidate = chain[chain.length - hops]
  } else {
    throw new Error('Invalid trusted proxy mode')
  }
  const ip = normalizeIp(candidate)
  if (!ip) throw new Error('Invalid trusted client IP')
  return ip
}
