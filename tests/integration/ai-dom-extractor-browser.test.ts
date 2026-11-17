import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { chromium } from '@playwright/test'
import { extractInteractiveElements } from '../../scripts/ai-uat/dom-extractor'
import { runScenario } from '../../scripts/ai-uat/agent-driver'

test('AI sees the active modal instead of exhausting its budget on background controls', {
  skip: process.env.AI_UAT_BROWSER_TEST !== '1',
}, async () => {
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage()
    await page.setContent(`${'<button>Background action</button>'.repeat(80)}
      <dialog open><label for="item-name">ชื่อสิ่งของ</label><input id="item-name" placeholder="ตัวอย่างชื่อ">
      <button aria-label="บันทึกรายการ">บันทึก</button></dialog>`)
    const snapshot=await extractInteractiveElements(page)
    assert.deepEqual(snapshot.elements.map(element=>element.label),['ชื่อสิ่งของ','บันทึกรายการ'])
    await page.locator(snapshot.elements[0].selector).fill('Synthetic asset')
    assert.equal(await page.locator('#item-name').inputValue(),'Synthetic asset')
  } finally {await browser.close()}
})

test('read-only AI assertions do not falsely flag a responsive page as stagnant', {
  skip: process.env.AI_UAT_BROWSER_TEST !== '1',
}, async () => {
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage();await page.setContent('<button>Responsive static screen</button>')
    let step=0
    const client={decideNextAction:async()=>++step<3
      ? {thought:'Observe unchanged page',tool:'assert_condition' as const,args:{passed:true,assertion:'Visible screen',observation:'Synthetic page'}}
      : {thought:'Read-only checks done',tool:'complete_goal' as const,args:{status:'PASS',summary:'Synthetic observations complete'}}}
    const result=await runScenario(page,{id:'SYNTHETIC-READONLY',role:'user',title:'Synthetic read-only checks',goal:'Observe twice then complete',successCriteria:['Read-only assertions'],maxSteps:4},client,'.cache/ai-driver-readonly-regression')
    assert.equal(result.status,'PASS')
    await page.setContent('<form><input name="newPassword" type="password" required><button>Save</button></form>')
    let validationStep=0
    const validationClient={decideNextAction:async(context:{previousSteps:Array<{result:string}>})=>{
      if(++validationStep===1)return {thought:'Submit empty form',tool:'click_element' as const,args:{id:2}}
      assert.match(context.previousSteps[0].result,/browser validation/)
      assert.match(context.previousSteps[0].result,/newPassword/)
      assert.match(context.previousSteps[0].result,/"valueMissing":true/)
      return {thought:'Observed validation',tool:'complete_goal' as const,args:{status:'PASS',summary:'Native validation reported'}}
    }}
    const validation=await runScenario(page,{id:'SYNTHETIC-VALIDATION',role:'user',title:'Native validation',goal:'Observe empty form rejection',successCriteria:['Validation observation'],maxSteps:3},validationClient,'.cache/ai-driver-validation-regression')
    assert.equal(validation.status,'PASS')
  } finally {await browser.close()}
})

test('selected-item actions stay within the AI element budget on a large ledger', {
  skip: process.env.AI_UAT_BROWSER_TEST !== '1',
}, async () => {
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage()
    await page.setContent(`${'<button>Background row action</button>'.repeat(80)}<div role="region" aria-label="จัดการรายการที่เลือก"><button>แก้ไขข้อมูล</button><button>ลบทั้งหมด</button></div>`)
    const snapshot=await extractInteractiveElements(page)
    assert.deepEqual(snapshot.elements.slice(0,2).map(element=>element.label),['แก้ไขข้อมูล','ลบทั้งหมด'])
  } finally {await browser.close()}
})

test('distinct permission-check URLs redirecting to one dashboard are valid progress', {
  skip: process.env.AI_UAT_BROWSER_TEST !== '1',
}, async () => {
  const server=createServer((request,response)=>{
    if(request.url?.startsWith('/forbidden')) {response.writeHead(302,{location:'/dashboard'});response.end()}
    else {response.writeHead(200,{'content-type':'text/html'});response.end('<button>Dashboard</button>')}
  })
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
  const address=server.address()
  assert.ok(address && typeof address !== 'string')
  const baseURL=`http://127.0.0.1:${address.port}`
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage({baseURL})
    await page.goto('/dashboard')
    let step=0
    const observations: string[]=[]
    const client={decideNextAction:async(context: {previousSteps: Array<{result:string}>})=>{
      observations.push(...context.previousSteps.map(previous=>previous.result))
      return ++step<3
      ? {thought:'Check denied route',tool:'navigate_to' as const,args:{path:`/forbidden-${step}`}}
      : {thought:'Done',tool:'complete_goal' as const,args:{status:'PASS',summary:'Redirects verified'}}}}
    const result=await runScenario(page,{id:'SYNTHETIC-REDIRECT',role:'user',title:'Redirect checks',goal:'Check two denied URLs',successCriteria:['Redirect'],maxSteps:4},client,'.cache/ai-driver-redirect-regression')
    assert.equal(result.status,'PASS')
    assert.ok(observations.some(result=>result.includes('/forbidden-1') && result.includes(`${baseURL}/dashboard`)),JSON.stringify(observations))
  } finally {await browser.close();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
})

test('downloads and popup previews count as progress without changing the parent DOM', {
  skip: process.env.AI_UAT_BROWSER_TEST !== '1',
}, async () => {
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage()
    await page.setContent(`<button onclick="const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['synthetic']));a.download='fixture.txt';a.click()">Download</button><button onclick="window.open('about:blank')">Preview</button>`)
    let step=0
    const client={decideNextAction:async()=>++step<3
      ? {thought:'Export',tool:'click_element' as const,args:{id:step}}
      : {thought:'Done',tool:'complete_goal' as const,args:{status:'PASS',summary:'Exports observed'}}}
    const result=await runScenario(page,{id:'SYNTHETIC-EXPORT',role:'admin',title:'Export checks',goal:'Download and preview',successCriteria:['External events'],maxSteps:4},client,'.cache/ai-driver-export-regression')
    assert.equal(result.status,'PASS')
  } finally {await browser.close()}
})
