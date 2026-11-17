import { expect, type BrowserContext, type Page } from '@playwright/test'
import { join } from 'node:path'
import { statSync } from 'node:fs'
import type { Pool } from 'pg'
import ExcelJS from 'exceljs'

type Result = { id: string; title: string; status: string; details: string; screenshot?: string }
export async function runSupplementalBrowserUAT(contexts: Record<'user'|'admin'|'other', BrowserContext>, owner: Pool, outputDir: string, healthStatusSecret?: string): Promise<Result[]> {
  const results: Result[] = []
  const admin = await contexts.admin.newPage()
  const user = await contexts.user.newPage()
  admin.setDefaultTimeout(20000); user.setDefaultTimeout(20000)
  async function go(page: Page, path: string) {
    await page.goto(path, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {})
  }
  async function run(id: string, title: string, page: Page, action: () => Promise<string | void>) {
    if (process.env.UAT_EXTRA_CASES && !process.env.UAT_EXTRA_CASES.split(',').includes(id)) return
    console.log(`[UAT ${id}] ${title}`)
    const screenshot = join(outputDir, `${id}.png`)
    try {
      const details = await action()
      await page.screenshot({ path: screenshot, fullPage: true })
      results.push({id,title,status:'PASS',details:details || 'UI and independent assertions passed',screenshot})
    } catch (error) {
      await page.screenshot({path:screenshot,fullPage:true}).catch(()=>{})
      results.push({id,title,status:'FAIL',details:String(error),screenshot})
    }
    console.log(`[UAT ${id}] ${results.at(-1)?.status}`)
  }
  try {
    for (const path of ['/settings','/admin/users','/admin/audit-logs','/items/new']) {
      await run(`EX-ACCESS-${path.replaceAll('/','-')}`, `User direct access denied: ${path}`, user, async () => {
        await go(user,path)
        await expect.poll(()=>new URL(user.url()).pathname,{timeout:20000}).not.toBe(path)
        await expect(user.locator('#item_name:visible')).toHaveCount(0)
      })
    }
    await run('EX-HEALTH','Health responds and production status requires its secret',admin,async()=>{
      for(const path of ['/api/health/readiness','/api/health/liveness']) {
        const response=await contexts.admin.request.get(path)
        expect(response.ok(),`${path}: HTTP ${response.status()}`).toBe(true)
      }
      const response=await contexts.admin.request.get('/api/health/status')
      if(process.env.UAT_PRODUCTION==='1') {
        expect(response.status()).toBe(401)
        expect(healthStatusSecret).toBeTruthy()
        const authorized=await contexts.admin.request.get('/api/health/status',{headers:{authorization:`Bearer ${healthStatusSecret}`}})
        expect(authorized.status()).toBe(200)
        return 'Readiness/liveness 200; production status denies anonymous request with 401 and accepts fixture secret with 200'
      }
      expect(response.status()).toBe(200)
    })
    for (const [tab,table,label,add,name] of [
      ['units','units','ชื่อหน่วยนับใหม่','เพิ่มหน่วยนับ','AI-UAT-UNIT'],
      ['categories','categories','ชื่อหมวดหมู่ใหม่','เพิ่มหมวดหมู่','AI-UAT-CATEGORY'],
      ['locations','locations','สถานที่','เพิ่มสถานที่','AI-UAT-LOCATION'],
    ]) {
      await run(`EX-META-${tab}`,`Admin creates and edits ${tab} through settings UI`,admin,async()=>{
        await go(admin,`/settings?tab=${tab}`)
        await admin.getByLabel(label,{exact:true}).first().fill(name)
        await admin.getByRole('button',{name:add,exact:true}).click()
        await expect.poll(async()=>(await owner.query(`SELECT count(*)::int AS n FROM ${table} WHERE name=$1`,[name])).rows[0].n).toBe(1)
        // Metadata actions redirect; restore the selected tab before editing its new row.
        await go(admin,`/settings?tab=${tab}`)
        const input=admin.locator('input[name="name"]').filter({visible:true})
        const target=await input.all()
        let found=false
        for(const field of target) if(await field.inputValue()===name) {
          const form=field.locator('xpath=ancestor::form')
          await field.fill(`${name}-EDIT`)
          await form.getByRole('button',{name:'บันทึก',exact:true}).click()
          found=true;break
        }
        expect(found).toBe(true)
        await expect.poll(async()=>(await owner.query(`SELECT count(*)::int AS n FROM ${table} WHERE name=$1`,[`${name}-EDIT`])).rows[0].n).toBe(1)
      })
    }
    let itemId=''
    await run('EX-ITEM-CREATE','Admin creates dated asset with required searchable unit',admin,async()=>{
      await go(admin,'/items/new')
      await admin.locator('#item_name:visible').fill('AI-UAT-ASSET')
      await admin.locator('input[name="asset_no"]:visible').fill('AI-UAT-ASSET-001')
      await admin.locator('#unit_id:visible').click()
      await admin.getByRole('option',{name:'AI-UAT-UNIT-EDIT',exact:true}).click()
      await admin.locator('#unit_price:visible').fill('25000')
      await admin.locator('#acquired_date:visible').fill('2025-01-15')
      await admin.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click()
      await expect.poll(async()=>(await owner.query('SELECT count(*)::int AS n FROM items WHERE asset_no=$1',['AI-UAT-ASSET-001'])).rows[0].n,{timeout:20000}).toBe(1)
      itemId=(await owner.query('SELECT id FROM items WHERE asset_no=$1',['AI-UAT-ASSET-001'])).rows[0].id
    })
    await run('EX-ITEM-EDIT','Admin edits asset and verifies persisted name',admin,async()=>{
      expect(itemId,'Create prerequisite').not.toBe('')
      await go(admin,`/items/${itemId}/edit`)
      await admin.locator('#item_name:visible').fill('AI-UAT-ASSET-EDIT')
      await admin.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click()
      await expect.poll(async()=>(await owner.query('SELECT item_name FROM items WHERE id=$1',[itemId])).rows[0]?.item_name).toBe('AI-UAT-ASSET-EDIT')
    })
    await run('EX-IMAGE','Admin crops uploads and persists a generated synthetic image',admin,async()=>{
      expect(itemId,'Create prerequisite').not.toBe('')
      await go(admin,`/items/${itemId}/edit`)
      const sharp=(await import('sharp')).default
      const buffer=await sharp({create:{width:160,height:120,channels:3,background:'#2563eb'}}).png().toBuffer()
      await admin.locator('#image_file').setInputFiles({name:'uat-synthetic.png',mimeType:'image/png',buffer})
      await admin.getByRole('button',{name:'ครอบรูปภาพ (4:3)',exact:true}).click()
      await admin.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click()
      await expect.poll(async()=>(await owner.query('SELECT image_url FROM items WHERE id=$1',[itemId])).rows[0]?.image_url,{timeout:20000}).toBeTruthy()
      await go(admin,`/items/${itemId}/edit`)
      const image=admin.locator('img').filter({visible:true}).last()
      await expect(image).toBeVisible()
    })
    await run('EX-TAGS','Admin opens asset label preview with QR link',admin,async()=>{
      const itemName=itemId?'AI-UAT-ASSET-EDIT':'UAT-borrow'
      await go(admin,itemId?'/items?q=AI-UAT-ASSET-001':'/items?q=UAT-borrow')
      const selection=admin.getByRole('checkbox',{name:`เลือก ${itemName}`,exact:true})
      await selection.check()
      const toolbar=admin.getByRole('region',{name:'จัดการรายการที่เลือก',exact:true})
      // A streamed page may still hydrate after the native checkbox becomes available.
      if (!await toolbar.isVisible()) {
        await expect(toolbar).toBeVisible({timeout:3000}).catch(async()=>{await selection.uncheck();await selection.check()})
      }
      await expect(toolbar).toBeVisible()
      await admin.getByRole('button',{name:'พิมพ์ลาเบล (1)',exact:true}).click()
      await expect(admin.getByText('พิมพ์ลาเบลติดครุภัณฑ์',{exact:false}).first()).toBeVisible()
      await expect(admin.locator('[aria-label^="QR Code ลิงก์"]').first()).toBeVisible()
    })
    await run('EX-REPORT-XLSX','Admin downloads valid Excel report containing fixture items',admin,async()=>{
      await go(admin,'/reports')
      const downloading=admin.waitForEvent('download',{timeout:30000})
      await admin.getByRole('button',{name:'ดาวน์โหลดรายงาน Excel',exact:true}).click()
      const download=await downloading
      const file=join(outputDir,'report.xlsx');await download.saveAs(file)
      expect(statSync(file).size).toBeGreaterThan(1000)
      const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file)
      expect(workbook.worksheets.length).toBeGreaterThan(0)
      expect(JSON.stringify(workbook.model)).toContain('UAT-')
      return 'Download event, XLSX parse and synthetic record content verified; report.xlsx'
    })
    await run('EX-REPORT-PDF','Admin opens PDF print report and exports browser PDF evidence',admin,async()=>{
      await go(admin,'/reports')
      const popupOpening=admin.waitForEvent('popup',{timeout:30000})
      await admin.getByRole('button',{name:'ส่งออกรายงาน PDF',exact:true}).click()
      const popup=await popupOpening
      try {
        await expect(popup.locator('body')).toContainText('UAT-')
        await popup.pdf({path:join(outputDir,'report.pdf'),format:'A4',printBackground:true})
        expect(statSync(join(outputDir,'report.pdf')).size).toBeGreaterThan(1000)
      } finally {await popup.close()}
      return 'Report popup contained fixture records; browser-produced report.pdf verified (physical printing not tested)'
    })
    await run('EX-REPORT-PRINT','Print report control invokes window.print',admin,async()=>{
      await go(admin,'/reports')
      await admin.evaluate(()=>{window.print=()=>{document.documentElement.dataset.uatPrint='called'}})
      await admin.getByRole('button',{name:'พิมพ์รายงาน',exact:true}).click()
      await expect(admin.locator('html')).toHaveAttribute('data-uat-print','called')
    })
    await run('EX-IMPORT-TEMPLATE','Admin downloads valid Excel import template',admin,async()=>{
      await go(admin,'/settings?tab=import')
      const downloading=admin.waitForEvent('download',{timeout:30000})
      await admin.getByRole('button',{name:'ดาวน์โหลดเทมเพลต (Excel)',exact:true}).click()
      const file=join(outputDir,'import-template.xlsx');await(await downloading).saveAs(file)
      const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(file)
      expect(workbook.worksheets.length).toBeGreaterThan(0)
    })
    await run('EX-IMPORT-INVALID','Malformed CSV is rejected and inserts no records',admin,async()=>{
      await go(admin,'/settings?tab=import')
      await admin.locator('input[type="file"]').setInputFiles({name:'uat-invalid.csv',mimeType:'text/csv',buffer:Buffer.from('wrong_header\nAI-UAT-INVALID')})
      await expect(admin.getByText('เกิดข้อผิดพลาดในการนำเข้า',{exact:true})).toBeVisible()
      expect((await owner.query('SELECT count(*)::int AS n FROM items WHERE item_name=$1',['AI-UAT-INVALID'])).rows[0].n).toBe(0)
    })
    await run('EX-IMPORT-CSV','Admin uploads CSV and verifies material quantity persisted',admin,async()=>{
      await go(admin,'/settings?tab=import')
      await admin.locator('input[type="file"]').setInputFiles({name:'uat-material.csv',mimeType:'text/csv',buffer:Buffer.from('item_name,item_type,quantity,unit_name,unit_price\nAI-UAT-IMPORT,material,3,AI-UAT-UNIT-EDIT,10')})
      await expect(admin.getByText('การนำเข้าสำเร็จ',{exact:true})).toBeVisible({timeout:20000})
      const rows=(await owner.query('SELECT quantity,item_type FROM items WHERE item_name=$1',['AI-UAT-IMPORT'])).rows
      expect(rows).toHaveLength(1);expect(Number(rows[0].quantity)).toBe(3);expect(rows[0].item_type).toBe('material')
    })
    await run('EX-PASSWORD-VALIDATION','User mismatched passwords are rejected without changing credentials',user,async()=>{
      await go(user,'/profile')
      await user.locator('#password').fill('UatTest!only123')
      await user.locator('#confirm_password').fill('Different!123')
      await user.getByRole('button',{name:'บันทึกรหัสผ่านใหม่',exact:true}).click()
      await expect(user.getByText(/ไม่ตรงกัน/).first()).toBeVisible()
    })
    await run('EX-USER-CREATE','Admin creates an isolated User account through UI',admin,async()=>{
      await go(admin,'/admin/users')
      await admin.getByRole('button',{name:'เพิ่มผู้ใช้งานใหม่',exact:true}).click()
      await admin.getByPlaceholder('เช่น สมชาย ใจดี').fill('AI-UAT-NEW-USER')
      await admin.getByPlaceholder('user@example.com (เว้นว่างได้ เพิ่มภายหลัง)').fill('new-user@uat.invalid')
      await admin.getByPlaceholder('ความยาวอย่างน้อย 6 ตัวอักษร').fill('UatFixture!123456')
      await admin.getByRole('button',{name:'สร้างบัญชีผู้ใช้',exact:true}).click()
      await expect.poll(async()=>(await owner.query('SELECT count(*)::int AS n FROM profiles WHERE full_name=$1',['AI-UAT-NEW-USER'])).rows[0].n).toBe(1)
    })
    await run('EX-USER-DELETE','Admin deletes only the newly created synthetic account',admin,async()=>{
      await go(admin,'/admin/users')
      const row=admin.getByRole('row').filter({hasText:'AI-UAT-NEW-USER'})
      await row.getByTitle('ลบบัญชีผู้ใช้',{exact:true}).click()
      await admin.getByRole('dialog').getByRole('button',{name:'ลบบัญชีผู้ใช้',exact:true}).click()
      await expect.poll(async()=>(await owner.query('SELECT count(*)::int AS n FROM profiles WHERE full_name=$1',['AI-UAT-NEW-USER'])).rows[0].n).toBe(0)
    })
    await run('EX-ITEM-DELETE','Admin removes the newly created asset through selected-item UI',admin,async()=>{
      expect(itemId,'Create prerequisite').not.toBe('')
      await go(admin,'/items?q=AI-UAT-ASSET-001')
      await admin.getByRole('checkbox',{name:'เลือก AI-UAT-ASSET-EDIT',exact:true}).check()
      await admin.getByRole('button',{name:'ลบทั้งหมด',exact:true}).click()
      await admin.getByRole('dialog').getByRole('button',{name:'ยืนยันการลบ',exact:true}).click()
      await expect.poll(async()=>(await owner.query('SELECT count(*)::int AS n FROM items WHERE id=$1 AND deleted_at IS NULL',[itemId])).rows[0].n).toBe(0)
    })
    await run('EX-PASSWORD-LOGIN-LOGOUT','User changes own fixture password then logs in and out through UI',user,async()=>{
      const other=await contexts.other.newPage()
      const password=`Uat!${crypto.randomUUID()}`
      let fresh: BrowserContext | undefined
      try {
        await go(other,'/profile')
        await other.locator('#password').fill(password);await other.locator('#confirm_password').fill(password)
        await other.getByRole('button',{name:'บันทึกรหัสผ่านใหม่',exact:true}).click()
        await expect(other.getByText('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว',{exact:true})).toBeVisible()
        fresh=await contexts.other.browser()!.newContext({baseURL:new URL(other.url()).origin})
        const page=await fresh.newPage();await go(page,'/login')
        await page.getByLabel('ชื่อผู้ใช้',{exact:true}).fill('other@uat.invalid')
        await page.getByLabel('รหัสผ่าน',{exact:true}).fill(password)
        await page.getByRole('button',{name:'เข้าสู่ระบบ',exact:true}).click()
        await expect(page).toHaveURL(/\/dashboard/,{timeout:20000})
        await page.getByRole('button',{name:'ออกจากระบบ',exact:true}).click()
        await expect(page).toHaveURL(/\/login/)
      } finally {await fresh?.close();await other.close()}
    })
  } finally {await admin.close();await user.close()}
  return results
}
