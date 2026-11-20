import http from 'node:http'
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'

const HOST = '127.0.0.1'
const PORT = 3001
const CAMMS = 'http://localhost:3000'
const secret = process.env.SSO_JWT_SECRET
const clientSecret = process.env.SSO_LOCAL_TEST_CLIENT_SECRET
const subject = process.env.SSO_LOCAL_TEST_SUBJECT
if (!secret || Buffer.byteLength(secret) < 32 || !clientSecret || Buffer.byteLength(clientSecret) < 32 || !subject) {
  console.error('Set SSO_JWT_SECRET, SSO_LOCAL_TEST_CLIENT_SECRET (>=32 bytes each), and SSO_LOCAL_TEST_SUBJECT')
  process.exit(1)
}

const codes = new Map()
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const sign = claims => {
  const data = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode(claims)
  return data + '.' + createHmac('sha256', secret).update(data).digest('base64url')
}
const equal = (a, b) => {
  const aa = Buffer.from(a), bb = Buffer.from(b)
  return aa.length === bb.length && timingSafeEqual(aa, bb)
}
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers })
  res.end(body)
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://' + HOST + ':' + PORT)
  if (req.method === 'GET' && url.pathname === '/') {
    return send(res, 200, '<!doctype html><html lang="th"><meta charset="utf-8"><title>CAMMS SSO Test</title><body style="font:16px system-ui;max-width:560px;margin:12vh auto"><h1>SSO Test Portal</h1><p>Local development only. Subject: ' + subject.replace(/[&<>"']/g, '') + '</p><form method="post" action="/login"><button style="padding:12px 24px">Login to CAMMS</button></form></body></html>', { 'Content-Type': 'text/html; charset=utf-8' })
  }
  if (req.method === 'POST' && url.pathname === '/login') {
    if (req.headers.origin && req.headers.origin !== 'http://' + HOST + ':' + PORT) return send(res, 403, 'Origin rejected')
    const code = randomBytes(32).toString('hex')
    codes.set(code, Date.now() + 60_000)
    return send(res, 303, '', { Location: CAMMS + '/api/auth/sso/local-test?code=' + code })
  }
  if (req.method === 'POST' && url.pathname === '/exchange') {
    if (!equal(req.headers['x-client-secret'] ?? '', clientSecret)) return send(res, 403, 'Forbidden')
    let body = ''
    for await (const chunk of req) {
      body += chunk
      if (body.length > 1024) return send(res, 413, 'Too large')
    }
    let code
    try { code = JSON.parse(body).code } catch { return send(res, 400, 'Invalid JSON') }
    if (typeof code !== 'string' || !/^[a-f0-9]{64}$/.test(code)) return send(res, 400, 'Invalid code')
    const expiry = codes.get(code)
    codes.delete(code)
    if (!expiry || expiry < Date.now()) return send(res, 400, 'Expired or consumed')
    const now = Math.floor(Date.now() / 1000)
    const token = sign({ iss: 'camms-local-test', aud: 'camms-local', sub: subject, iat: now, nbf: now, exp: now + 60, jti: randomUUID() })
    return send(res, 200, JSON.stringify({ token }), { 'Content-Type': 'application/json' })
  }
  return send(res, 404, 'Not found')
})
server.listen(PORT, HOST, () => console.log('SSO Test Portal http://' + HOST + ':' + PORT))
