import { cookies } from 'next/headers'
import { isPostgresBackend } from '@/lib/backend'
import { profileForToken, SESSION_COOKIE } from '@/lib/postgres/session'
import { subscribeChanges } from '@/lib/postgres/events'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  if (!isPostgresBackend()) return new Response(null,{status:404})
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const profile = await profileForToken(token)
  if (!profile) return new Response(null,{status:401})
  const allowed = new Set(['items','categories','locations','units',...(profile.role==='admin'?['audit_logs']:[])])
  const requested = (new URL(request.url).searchParams.get('tables') ?? '').split(',').filter((table) => allowed.has(table))
  let close: (cancelled?: boolean) => void = () => {}
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let stopped=false
      let unsubscribe = () => {}
      const encoder = new TextEncoder()
      const send = (value: string) => { if (!stopped) controller.enqueue(encoder.encode(`data: ${value}\n\n`)) }
      const interval = setInterval(() => {
        void profileForToken(token).then((current) => {
          if (!current || current.role !== profile.role) { close(); return }
          send('heartbeat')
        }).catch(() => close())
      },15000)
      const onAbort = () => close()
      close = (cancelled = false) => { if (stopped) return; stopped=true; clearInterval(interval); unsubscribe(); request.signal.removeEventListener('abort',onAbort); if (!cancelled) controller.close() }
      request.signal.addEventListener('abort',onAbort,{ once:true })
      try {
        unsubscribe = await subscribeChanges((table) => { if (requested.includes(table)) send(table) },() => send('reconnect'))
        if (stopped) unsubscribe()
        else send('reconnect')
      } catch { close() }
      if (request.signal.aborted) close()
    }, cancel() { close(true) },
  })
  return new Response(stream,{headers:{'Content-Type':'text/event-stream','Cache-Control':'private, no-store','Connection':'keep-alive','X-Accel-Buffering':'no'}})
}
