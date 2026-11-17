import { expect, type BrowserContext } from '@playwright/test'
import { join } from 'node:path'

type Result = { id: string; title: string; status: string; details: string; screenshot?: string }

/** Broad UI checks against the same disposable fixture as transaction UAT. */
export async function runSystemBrowserUAT(contexts: Record<'user' | 'admin', BrowserContext>, outputDir: string): Promise<Result[]> {
  const results: Result[] = []
  for (const role of ['user', 'admin'] as const) {
    for (const route of ['/dashboard', '/items', '/locations', '/reports', '/profile', '/settings', '/admin/users', '/admin/audit-logs']) {
      const page = await contexts[role].newPage()
      page.setDefaultTimeout(15000)
      const id = `SYS-${role}-${route.slice(1).replaceAll('/', '-')}`
      const errors: string[] = []
      const handler = (error: Error) => errors.push(error.message)
      page.on('pageerror', handler)
      try {
        const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 90000 })
        // Realtime EventSource remains open; networkidle is not a usable readiness signal.
        await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {})
        await expect(page.locator('body')).toBeVisible()
        await expect(page.getByRole('button').first()).toBeVisible()
        const text = await page.locator('body').innerText()
        expect(text).not.toMatch(/Application error:|Internal Server Error|เกิดข้อผิดพลาดที่ไม่คาดคิด/)
        expect(errors).toEqual([])
        if (role === 'user' && (route.startsWith('/admin/') || route === '/settings')) {
          await expect.poll(async () => new URL(page.url()).pathname !== route || /ไม่มีสิทธิ์|ไม่อนุญาต|เฉพาะผู้ดูแล/.test(await page.locator('body').innerText()) || response?.status() === 403,
            { timeout: 20000, message: 'Restricted route must deny User access' }).toBe(true)
        } else {
          expect(response?.ok()).toBe(true)
          expect(new URL(page.url()).pathname).toBe(route)
          if (route === '/items') {
            await expect(page.locator('table').first()).toBeVisible()
            if (role === 'user') await expect(page.getByRole('button', { name: 'เพิ่มรายการ', exact: true })).toHaveCount(0)
          }
        }
        const screenshot = join(outputDir, `${id}.png`)
        await page.screenshot({ path: screenshot, fullPage: true })
        results.push({ id, title: `${role}: ${route} renders and respects access`, status: 'PASS', details: `HTTP ${response?.status()}, final route ${new URL(page.url()).pathname}; no uncaught page errors`, screenshot })
      } catch (error) {
        const screenshot = join(outputDir, `${id}.png`)
        await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {})
        results.push({ id, title: `${role}: ${route} renders and respects access`, status: 'FAIL', details: String(error), screenshot })
      } finally { page.off('pageerror', handler); await page.close() }
      console.log(`[UAT ${id}] ${results.at(-1)?.status}`)
    }
  }
  return results
}
