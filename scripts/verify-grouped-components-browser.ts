import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'
import { readFileSync, readdirSync, mkdirSync } from 'node:fs'
import path from 'node:path'

// Component-level browser harness: real React/Radix and app CSS, mocked server boundary.
// It performs no database writes and does not claim authenticated end-to-end coverage.
async function main() {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React, { useEffect, useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { GroupedTransactionsTable } from './features/disbursements/components/grouped-transactions-table';
      const initial = {
        id:'fixture-document', document_no:'BOR-2569-0001', transaction_type:'asset_borrow',
        recipient_name:'ผู้ยืมตัวอย่าง', department_name:'กลุ่มงานเทคโนโลยี', purpose:'ประชุมประจำเดือน',
        status:'active_borrow', due_date:'2026-11-20', created_at:'2026-11-12', confirmed_at:'2026-11-12',
        requested_items:[1,2,3].map(n=>({line_id:'line-'+n,item_id:'asset-'+n,item_name:'เครื่องคอมพิวเตอร์โน้ตบุ๊ก '+n,asset_no:'7440-002-000'+n,requested_qty:1,issued_qty:1,returned_qty:0,status:'issued'}))
      };
      function App(){
        const [doc,setDoc]=useState(initial);
        useEffect(()=>{const receive=()=>setDoc(previous=>({...previous,status:'partially_returned',requested_items:previous.requested_items.map(line=>line.line_id===window.fixtureReturned?{...line,returned_qty:1,status:'returned'}:line)}));window.addEventListener('fixture-refresh',receive);return()=>window.removeEventListener('fixture-refresh',receive)},[]);
        return <main style={{padding:24}}><h1 style={{marginBottom:16}}>คำขอยืม</h1><GroupedTransactionsTable documents={[doc]} userRole="admin" /></main>
      }
      createRoot(document.getElementById('app')).render(<App/>);
    ` },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'server-boundary', setup(builder) {
      builder.onResolve({ filter: /^next\/(navigation|link)$/ }, args => ({ path: args.path, namespace: 'fixture' }))
      builder.onResolve({ filter: /(^|\/)actions$/ }, args => args.importer.includes('disbursements') ? { path: 'actions', namespace: 'fixture' } : undefined)
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ resolveDir: process.cwd(), loader: 'js', contents: args.path === 'next/link'
        ? "import React from 'react'; export default React.forwardRef((props,ref)=>React.createElement('a',{...props,ref},props.children))"
        : args.path === 'next/navigation'
          ? "export const useRouter=()=>({refresh:()=>window.dispatchEvent(new Event('fixture-refresh'))});"
          : "export async function returnDisbursementItem(input){window.fixtureReturned=input.line_id;return {ok:true}}; export const confirmDisbursement=async()=>({ok:true}); export const rejectDisbursement=confirmDisbursement; export const cancelDisbursementDraft=confirmDisbursement;" }))
    } }],
  })
  const cssDir = '.next/static/css'
  const css = readdirSync(cssDir).filter(file => file.endsWith('.css')).map(file => readFileSync(path.join(cssDir, file), 'utf8')).join('\n')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  mkdirSync('.cache/grouped-transactions', { recursive: true })
  try {
    await page.setContent('<!doctype html><html lang="th"><body><div id="app"></div></body></html>')
    await page.addStyleTag({ content: css })
    await page.addScriptTag({ content: result.outputFiles[0].text })
    const expand = page.getByRole('button', { name: /^ขยายรายการ/ })
    await expand.click()
    const receive = page.getByRole('button', { name: 'รับคืน 7440-002-0001', exact: true })
    await receive.click()
    await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click()
    await expect(receive).toBeFocused()
    await receive.click()
    await page.getByRole('button', { name: 'ยืนยันรับคืน', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^ย่อรายการ/ })).toBeFocused()
    await expect(receive).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^รับคืน 7440/ })).toHaveCount(2)
    await page.screenshot({ path: '.cache/grouped-transactions/component-desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('table', { name: 'รายการพัสดุในคำขอ' })).toBeVisible()
    await page.screenshot({ path: '.cache/grouped-transactions/component-mobile.png', fullPage: true })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.screenshot({ path: '.cache/grouped-transactions/component-mobile-dark.png', fullPage: true })
    console.log('PASS: real-browser expansion, cancel focus, successful partial-return refresh/focus, desktop and mobile rendering (mock server boundary)')
  } finally { await browser.close() }
}

void main().catch(error => { console.error(error instanceof Error ? error.message : 'Component browser verification failed'); process.exitCode = 1 })
