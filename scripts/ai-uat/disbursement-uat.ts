import { cpSync, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { resolve, join, basename } from 'node:path'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { parse } from 'dotenv'
import { Pool } from 'pg'
import { chromium, expect, type BrowserContext } from '@playwright/test'
import { hashPassword } from '../../lib/postgres/password'
import { getUATConfig } from './config'
import { GeminiUATClient } from './gemini-client'
import { runScenario } from './agent-driver'
import type { ScenarioResult, UATScenario } from './scenarios/types'
import { runDisbursementBrowserUAT } from './disbursement-browser-scenarios'
import { runSystemBrowserUAT } from './system-browser-scenarios'
import { runSupplementalBrowserUAT } from './supplemental-browser-scenarios'

const root = process.cwd()
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const outputDir = resolve(root, 'test-results', 'disbursement-uat', runId)
const workspace = resolve(root, '.cache', `disbursement-uat-${runId}`)
const port = process.env.UAT_PORT || '3107'
const baseUrl = `http://127.0.0.1:${port}`
const results: { id: string; title: string; status: string; details: string; screenshot?: string }[] = []
const aiResults: ScenarioResult[] = []
const pageErrors: string[] = []
let server: ChildProcess | undefined
let cleanup = false
let fixtureCreated = false
let management: Pool | undefined
let owner: Pool | undefined
let fixtureName = ''

function sanitizedError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[database connection]').replace(/key=[^&\s"']+/g, 'key=[redacted]')
}

async function main() {
  mkdirSync(outputDir, { recursive: true })
  mkdirSync(workspace, { recursive: true })
  mkdirSync(join(workspace, 'storage'), { recursive: true })
  const env = parse(readFileSync('.env.postgres.app'))
  const target = new URL(env.DATABASE_MIGRATION_URL)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname)) throw new Error('UAT requires a local disposable database host')
  fixtureName = `camms_uat_${randomUUID().replaceAll('-', '')}`
  if (!/^camms_uat_[a-f0-9]{32}$/.test(fixtureName)) throw new Error('Invalid fixture name')
  management = new Pool({ connectionString: env.DATABASE_MIGRATION_URL, connectionTimeoutMillis: 5000 })
  const fixtureUrl = (value: string) => { const url = new URL(value); url.pathname = `/${fixtureName}`; return url.toString() }
  await management.query(`CREATE DATABASE "${fixtureName}"`)
  fixtureCreated = true
  owner = new Pool({ connectionString: fixtureUrl(env.DATABASE_MIGRATION_URL) })
  for (const file of readdirSync('db/postgres/migrations').filter(f => /^\d{4}_.+\.sql$/.test(f)).sort()) {
    await owner.query(readFileSync(join('db/postgres/migrations', file), 'utf8'))
  }
  const fixture = { items: {} as Record<string, { id: string; name: string }>, users: { user: randomUUID(), other: randomUUID(), admin: randomUUID() } }
  const password = `Uat!${randomBytes(16).toString('hex')}`
  const healthStatusSecret = randomBytes(32).toString('hex')
  const passwordHash = await hashPassword(password)
  const tokens: Record<string, string> = {}
  for (const [role, id] of Object.entries(fixture.users)) {
    const fullName = role === 'admin' ? 'UAT Admin' : role === 'user' ? 'UAT User' : 'UAT Other'
    await owner.query('INSERT INTO profiles(id,full_name,email,role) VALUES($1,$2,$3,$4)', [id, fullName, `${role}@uat.invalid`, role === 'admin' ? 'admin' : 'user'])
    await owner.query('INSERT INTO private_auth.credentials(user_id,password_hash) VALUES($1,$2)', [id, passwordHash])
    const token = randomBytes(32).toString('hex'); tokens[role] = token
    await owner.query("INSERT INTO private_auth.sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '2 hours')", [createHash('sha256').update(token).digest('hex'), id])
  }
  for (const key of ['borrow', 'issueMaterial', 'issueAsset', 'cancel', 'reject', 'damaged', 'lost', 'reverse', 'concurrent', 'validation', 'aiBorrow', 'aiIssue', 'assignment', 'adminDraft']) {
    const id = randomUUID(), name = `UAT-${key}`
    fixture.items[key] = { id, name }
    const material = ['issueMaterial','reverse','adminDraft'].includes(key)
    await owner.query("INSERT INTO items(id,item_name,item_type,quantity,is_central,asset_no,status,note) VALUES($1,$2,$3,$4,true,$5,'active','UAT isolated fixture')", [id,name,material ? 'material' : 'asset',material ? 10 : 1,material ? null : `UAT-${key}`])
  }
  // Reference data belongs only to this disposable fixture and lets AI exercise required fields.
  await owner.query("INSERT INTO units(name) VALUES('UAT-unit')")
  await owner.query("INSERT INTO categories(name) VALUES('UAT-category')")
  // A separate source snapshot has no real environment files or real uploaded data.
  for (const folder of ['app','components','features','lib','hooks','db','public']) {
    if (existsSync(folder)) cpSync(resolve(root, folder), join(workspace, folder), { recursive: true })
  }
  for (const file of ['package.json','tsconfig.json','next-env.d.ts','next.config.ts','postcss.config.mjs','proxy.ts','instrumentation.ts']) {
    if (existsSync(file)) cpSync(resolve(root, file), join(workspace, file))
  }
  // Health routes import this runtime helper; include it without copying operational scripts or env files.
  mkdirSync(join(workspace, 'scripts'), { recursive: true })
  cpSync(resolve(root, 'scripts/verify-env.ts'), join(workspace, 'scripts/verify-env.ts'))
  symlinkSync(resolve(root, 'node_modules'), join(workspace, 'node_modules'), 'junction')
  const production = process.env.UAT_PRODUCTION === '1'
  if (production) {
    if (!existsSync(resolve(root, '.next/BUILD_ID'))) throw new Error('Production UAT requires a successful build first')
    cpSync(resolve(root, '.next'), join(workspace, '.next'), { recursive: true,
      filter: source => !['cache', 'dev', 'standalone'].includes(source.slice(resolve(root, '.next').length + 1).split(/[\\/]/)[0]),
    })
  }
  const log = createWriteStream(join(outputDir, 'server.log'))
  server = spawn(process.execPath, [resolve(root,'node_modules/next/dist/bin/next'),production?'start':'dev',...(production?[]:['--webpack']),'--hostname','127.0.0.1','--port',port], {
    cwd: workspace, windowsHide: true,
    env: { ...process.env, NODE_ENV: production?'production':'development', NODE_OPTIONS:'--max-old-space-size=2048', DATABASE_URL: fixtureUrl(env.DATABASE_URL), DATABASE_AUTH_URL: fixtureUrl(env.DATABASE_AUTH_URL), DATABASE_MIGRATION_URL: fixtureUrl(env.DATABASE_MIGRATION_URL), DATA_BACKEND:'postgres',NEXT_PUBLIC_DATA_BACKEND:'postgres', LOCAL_STORAGE_PATH:join(workspace,'storage'), HEALTH_STATUS_SECRET:healthStatusSecret, GEMINI_API_KEY:'', NEXT_TELEMETRY_DISABLED:'1' },
    stdio:['ignore','pipe','pipe'],
  })
  server.stdout?.pipe(log); server.stderr?.pipe(log)
  let ready = false
  for (let i=0;i<120;i++) {
    if (server.exitCode !== null) throw new Error('Isolated UAT server exited during startup')
    try { const response = await fetch(`${baseUrl}/login`, { signal: AbortSignal.timeout(3000) }); if (response.ok) { ready=true; break } } catch { /* compiling */ }
    await new Promise(r => setTimeout(r,1000))
  }
  if (!ready) throw new Error('Isolated UAT server did not become ready')
  console.log('UAT fixture database and isolated application are ready')
  const browser = await chromium.launch({ headless: true })
  try {
    const contexts = {} as Record<'user'|'other'|'admin',BrowserContext>
    for (const role of ['user','other','admin'] as const) {
      contexts[role] = await browser.newContext({ baseURL:baseUrl,viewport:{width:1440,height:1000} })
      await contexts[role].addCookies([{ name:'camms_session',value:tokens[role],url:baseUrl,httpOnly:true,sameSite:'Lax' }])
      contexts[role].on('page',page => page.on('pageerror',error => pageErrors.push(`${role}: ${sanitizedError(error)}`)))
    }
    // Login itself is exercised separately; scenario contexts use fixture sessions.
    const loginContext = await browser.newContext({baseURL:baseUrl})
    const loginPage = await loginContext.newPage()
    try {
      await loginPage.goto('/login',{waitUntil:'networkidle'})
      await loginPage.getByLabel('ชื่อผู้ใช้',{exact:true}).fill('viewer@uat.invalid')
      await loginPage.getByLabel('รหัสผ่าน',{exact:true}).fill(password)
      await loginPage.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click()
      await expect(loginPage).toHaveURL(/\/dashboard/,{timeout:60000})
      results.push({id:'UAT-LOGIN',title:'User login through real browser form',status:'PASS',details:'Fixture credentials authenticated through application UI'})
    } catch(error) { results.push({id:'UAT-LOGIN',title:'User login through real browser form',status:'FAIL',details:sanitizedError(error)}) }
    await loginContext.close()
    if (process.env.UAT_VERIFY_ALL === '1') {
      results.push(...await runDisbursementBrowserUAT({baseUrl,browser,contexts,fixture,owner,outputDir}))
      results.push(...await runSystemBrowserUAT(contexts, outputDir))
      results.push(...await runSupplementalBrowserUAT(contexts, owner, outputDir, healthStatusSecret))
    }
    else if (process.env.UAT_SUPPLEMENTAL_ONLY === '1') results.push(...await runSupplementalBrowserUAT(contexts, owner, outputDir, healthStatusSecret))
    else if (process.env.UAT_SYSTEM_ONLY === '1') results.push(...await runSystemBrowserUAT(contexts, outputDir))
    else results.push(...await runDisbursementBrowserUAT({baseUrl,browser,contexts,fixture,owner,outputDir}))
    if (process.env.UAT_SKIP_AI !== '1') {
    const config = getUATConfig()
    if (!config.apiKey) throw new Error('GEMINI_API_KEY is unavailable')
    const modelsResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {headers:{'x-goog-api-key':config.apiKey},signal:AbortSignal.timeout(20000)})
    if (!modelsResponse.ok) throw new Error(`AI model discovery HTTP ${modelsResponse.status}`)
    const models = (await modelsResponse.json()).models as {name:string;supportedGenerationMethods?:string[]}[]
    const available = models.filter(m=>m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name.replace('models/',''))
    const model = [config.model,'gemini-3.5-flash-lite','gemini-3-flash-preview','gemini-2.5-flash'].find(m=>available.includes(m))
    if (!model) throw new Error('No supported configured AI UAT model available')
    config.model=model; config.timeoutMs=Math.max(config.timeoutMs,45000); config.baseUrl=baseUrl
    const scenarios: UATScenario[] = [
      {id:'AI-UAT-USER',role:'user',title:'AI submits a borrow request',goal:'อยู่ที่หน้า /disbursements ให้ค้นหา UAT-aiBorrow กดปุ่มเลือกพัสดุรายการนี้ แล้วกดสร้างคำขอรวม เลือกประเภท ยืม กรอกวัตถุประสงค์ AI UAT และส่งคำขอ ใช้วันคืนเริ่มต้น เมื่อเห็นหน้ารายละเอียดคำขอรออนุมัติและชื่อ UAT-aiBorrow ให้ complete_goal PASS ห้ามแก้ไขรายการอื่น',successCriteria:['Request submitted through browser UI','Pending detail displays item name'],maxSteps:18},
      {id:'AI-UAT-ADMIN',role:'admin',title:'AI reviews approval and history',goal:'อยู่ที่หน้า /disbursements?tab=requests&status=all ขยายแถวเอกสารที่กำลังยืม ตรวจชื่อสิ่งของ UAT และจำนวน จากนั้นกดลิงก์เลขเอกสารในแถวเดิมเพื่อเปิดหน้ารายละเอียด ตรวจสถานะและผู้ขอ ห้ามสลับแท็บจ่ายเพราะเป็นหน้าผู้ถือครอง ห้ามอนุมัติ ปฏิเสธ ย้อนรายการ หรือแก้ข้อมูล แล้ว complete_goal ขณะอยู่หน้ารายละเอียดจริงเท่านั้น',successCriteria:['Items and quantities visible','Detail navigation works'],maxSteps:16},
    ]
    const transactionScenarios = [...scenarios]
    if (process.env.UAT_SYSTEM_ONLY === '1' || process.env.UAT_AI_ALL === '1') {
      scenarios.splice(0, scenarios.length,
        {id:'AI-SYS-VIEWER',role:'user',title:'User explores inventory, filters, inspector and reports',goal:'ทดสอบบนข้อมูลจำลองเท่านั้น เปิด /items ค้นหา UAT ตรวจแถวข้อมูล คลิกแถวเพื่อเปิดรายละเอียดและปิด จากนั้นเปิด /reports ตรวจตารางและตัวกรอง และ /dashboard ตรวจกราฟ ลองสลับตัวเลือกกราฟ ห้ามแก้ไขข้อมูล สรุปสิ่งที่ทดสอบจริงและข้อผิดพลาด อย่าอ้างว่าสิ่งที่ไม่ได้ทำผ่าน',successCriteria:['Inventory search and inspector exercised','Reports and chart controls exercised'],maxSteps:24},
        {id:'AI-SYS-ITEMS',role:'admin',title:'Admin inventory create edit delete lifecycle',goal:'ทดสอบสร้าง แก้ไข ลบพัสดุผ่าน UI เท่านั้น บนฐานข้อมูลจำลอง เปิด /items เพิ่มรายการชื่อ AI-UAT-CRUD เลขครุภัณฑ์ AI-UAT-CRUD-001 เลือกหน่วย UAT-unit และราคา 25000 กรอกช่องบังคับตามจริง ถ้าตัวเลือกว่างจนบันทึกไม่ได้ให้รายงานข้อขัดข้อง ห้ามแก้ฐานข้อมูล ถ้าสร้างได้ให้ค้นหาและแก้ชื่อเป็น AI-UAT-CRUD-EDIT แล้วเลือกเช็คบ็อกซ์หน้ารายการเพื่อใช้แถบแก้ไข/ลบ (ไม่ใช้ Inspector สำหรับแก้ไข) และลบเฉพาะรายการนี้ สรุปแต่ละขั้นที่ทำได้',successCriteria:['Create then edit then delete own synthetic item'],maxSteps:32},
        {id:'AI-SYS-EXPORT',role:'admin',title:'Admin report filters and exports',goal:'เปิด /reports ทดสอบค้นหา UAT และตัวกรอง ล้างตัวกรอง แล้วกดส่งออก Excel และ PDF หรือพิมพ์ที่มีจริง ตรวจข้อความผิดพลาด และสรุปสิ่งที่ทำได้ ห้ามรายงานว่าดาวน์โหลดสำเร็จหากไม่มีหลักฐาน',successCriteria:['Report filtering','Excel and PDF/print controls exercised'],maxSteps:18},
        {id:'AI-SYS-METADATA',role:'admin',title:'Admin settings and location CRUD',goal:'ใช้ /settings?tab=categories เพิ่มหมวดหมู่ AI-UAT-CATEGORY แก้ชื่อแล้วลบเฉพาะหมวดที่สร้าง ใช้ /settings?tab=units เพิ่มหน่วย AI-UAT-UNIT แล้วลบเฉพาะหน่วยนี้ ใช้ /settings?tab=locations เพิ่มสถานที่ AI-UAT-LOCATION แล้วลบเฉพาะสถานที่นี้ หลังบันทึกอาจ redirect ให้เปิด tab ที่ต้องการอีกครั้ง ห้ามลบข้อมูลอื่น สรุปแต่ละขั้นที่ทำจริง',successCriteria:['Metadata create edit delete through UI','Location management through UI'],maxSteps:40},
        {id:'AI-SYS-USERS',role:'admin',title:'Admin user management and audit review',goal:'เปิด /admin/users ตรวจค้นหา UAT User ตรวจตัวเลือกการจัดการแต่ห้ามเปลี่ยนสิทธิ์หรือลบบัญชีใด ตรวจว่าบัญชีตัวเองมีการป้องกัน จากนั้นเปิด /admin/audit-logs ทดลองค้นหาและตัวกรองและดูรายละเอียดประวัติ สรุปสิ่งที่ทำจริง',successCriteria:['User search and self-protection review','Audit search filter and details'],maxSteps:20},
        {id:'AI-SYS-PROFILE',role:'user',title:'User profile validation and unauthorized route protection',goal:'เปิด /profile ตรวจฟอร์มอีเมลและเปลี่ยนรหัสผ่าน ลองส่งฟอร์มว่างเพื่อทดสอบ validation เท่านั้น ห้ามเปลี่ยนรหัสผ่านหรืออีเมลจริง จากนั้นเปิด /items/new /admin/users /admin/audit-logs /settings โดยตรงทีละหน้าเพื่อตรวจการปฏิเสธสิทธิ์ สรุปตามผลจริง',successCriteria:['Profile validation','Direct restricted-route denial'],maxSteps:20},
      )
      if (process.env.UAT_AI_ALL === '1') scenarios.unshift(...transactionScenarios)
    }
    for (const scenario of scenarios) {
      if (process.env.UAT_AI_CASES && !process.env.UAT_AI_CASES.split(',').includes(scenario.id)) continue
      const context = contexts[scenario.role as 'user'|'admin']
      const page = await context.newPage()
      const downloads: string[] = []
      const reportPopups: string[] = []
      const evidenceTasks: Promise<void>[] = []
      page.on('download', download => {
        const name = basename(download.suggestedFilename())
        evidenceTasks.push(download.saveAs(join(outputDir, `${scenario.id}-${name}`)).then(() => { downloads.push(name) }))
      })
      if (scenario.id === 'AI-SYS-EXPORT') page.on('popup', popup => {
        evidenceTasks.push((async () => {
          try {
            await expect(popup.locator('body')).toContainText('UAT', { timeout: 15000 })
            await popup.pdf({ path: join(outputDir, `${scenario.id}.pdf`), format: 'A4' })
            reportPopups.push('Verified report PDF containing synthetic records')
          } finally { await popup.close() }
        })())
      })
      await page.goto(scenario.role==='user'?'/disbursements':'/disbursements?tab=requests&status=all',{waitUntil:'domcontentloaded'})
      await page.waitForLoadState('networkidle',{timeout:2000}).catch(()=>{})
      const client = new GeminiUATClient(config)
      const decide = client.decideNextAction.bind(client)
      client.decideNextAction = async prompt => {
        return decide({ ...prompt, compactDOM: `${prompt.compactDOM}\nVisible synthetic test data:\n${(await page.locator('body').innerText()).slice(0,14000)}` })
      }
      console.log(`[AI UAT] ${scenario.id} using ${model}`)
      const result=await runScenario(page,scenario,client,outputDir)
      await Promise.allSettled(evidenceTasks)
      aiResults.push(result)
      if (scenario.id==='AI-UAT-USER') {
        const verification=await owner.query("SELECT count(*)::int AS n FROM disbursements d JOIN disbursement_items di ON d.id=di.disbursement_id WHERE di.item_id=$1 AND d.created_by=$2 AND d.status='pending_approval'",[fixture.items.aiBorrow.id,fixture.users.user])
        if (verification.rows[0].n!==1) { result.status='FAIL';result.summary+='; independent DB verification found no submitted pending request' }
      }
      if (scenario.id==='AI-UAT-ADMIN' && !/^\/disbursements\/[a-f0-9-]{36}$/.test(new URL(page.url()).pathname)) {
        result.status='FAIL';result.summary+='; independent browser URL verification found no document detail navigation'
      }
      if (scenario.id==='AI-SYS-ITEMS' && result.status==='PASS') {
        const created = (await owner.query('SELECT item_name,deleted_at FROM items WHERE asset_no=$1',['AI-UAT-CRUD-001'])).rows
        if (!created.some(item=>item.item_name==='AI-UAT-CRUD-EDIT' && item.deleted_at)) {
          result.status='FAIL'; result.summary+='; independent verification did not confirm create/edit/delete lifecycle'
        }
      }
      if (scenario.id==='AI-SYS-EXPORT' && result.status==='PASS' && (!downloads.some(name=>name.endsWith('.xlsx')) || reportPopups.length===0)) {
        result.status='FAIL'; result.summary+='; independent download/PDF evidence was not complete'
      }
      const status = result.defects.some(defect => defect.title === 'การตัดสินใจของ AI ล้มเหลว') ? 'BLOCKED' : result.status
      results.push({id:scenario.id,title:scenario.title,status,details:result.summary})
      console.log(`[AI UAT] ${scenario.id} ${status}: ${sanitizedError(new Error(result.summary))}`)
      await page.close()
      // Persist incremental evidence even during a long provider-paced run.
      writeFileSync(join(outputDir,'ai-steps.json'),JSON.stringify({model,results:aiResults},null,2))
      writeFileSync(join(outputDir,'progress.json'),JSON.stringify({results,model},null,2))
    }
    writeFileSync(join(outputDir,'ai-steps.json'),JSON.stringify({model,results:aiResults},null,2))
    }
    for (const context of Object.values(contexts)) await context.close()
  } finally { await browser.close() }
}

async function finish() {
  if (server?.pid) {
    if (process.platform==='win32') spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'})
    else server.kill('SIGTERM')
  }
  await owner?.end()
  if (fixtureCreated && management) {
    if (!/^camms_uat_[a-f0-9]{32}$/.test(fixtureName)) throw new Error('Unsafe cleanup target')
    await management.query(`DROP DATABASE "${fixtureName}" WITH (FORCE)`)
    cleanup=true
  }
  await management?.end()
  mkdirSync(outputDir,{recursive:true})
  const data={timestamp:new Date().toISOString(),runtime:process.version,mode:process.env.UAT_PRODUCTION==='1'?'production':'development',results,aiResults,pageErrors,cleanup,scope:'User/Admin browser UAT on isolated synthetic PostgreSQL fixture'}
  writeFileSync(join(outputDir,'results.json'),JSON.stringify(data,null,2))
  const passed=results.filter(r=>r.status==='PASS').length
  const content=`# ผล AI UAT ระบบเบิกจ่าย\n\nวันที่: ${data.timestamp}\n\nผ่าน ${passed}/${results.length}; page errors ${pageErrors.length}; fixture cleanup ${cleanup}\n\nทดสอบแอปแยกด้วย Playwright และ Gemini AI ใช้ข้อมูลจำลองเท่านั้น\n\n| Case | Scenario | Result | Evidence |\n|---|---|---|---|\n${results.map(r=>`| ${r.id} | ${r.title} | ${r.status} | ${r.details.replace(/\|/g,'/').replace(/\n/g,' ').slice(0,1000)}${r.screenshot?` [screenshot](${r.screenshot})`:''} |`).join('\n')}\n\n## Page errors\n\n${pageErrors.length?pageErrors.map(e=>'- '+e).join('\n'):'None'}\n\nFull evidence: ${outputDir.replaceAll('\\','/')}\n`
  writeFileSync(join(outputDir,'SUMMARY.md'),content)
  console.log(JSON.stringify({uatReport:join(outputDir,'SUMMARY.md'),passed,total:results.length,cleanup,pageErrors:pageErrors.length}))
  if (results.some(result => result.status === 'FAIL')) process.exitCode = 1
}

main().catch(error=>{results.push({id:'UAT-RUNNER',title:'UAT execution infrastructure',status:'FAIL',details:sanitizedError(error)});console.error(sanitizedError(error));process.exitCode=1}).finally(finish)
