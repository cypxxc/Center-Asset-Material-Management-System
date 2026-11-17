/* eslint-disable */
import { Pool } from 'pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import ExcelJS from 'exceljs'
import * as path from 'path'
import { normalizeForStorage } from '../lib/unicode'
import { parseDateThaiBEToISO } from '../lib/date'
import { hashPassword } from '../lib/postgres/password'

interface SheetConfig {
  sheetIndex: number
  sheetName: string
  categoryCode: string
  categoryName: string
  isBelowThreshold: boolean | null
  isDonated: boolean
  defaultUnit?: string
}

const SHEET_CONFIGS: SheetConfig[] = [
  { sheetIndex: 0, sheetName: '1. ครุภัณฑ์สำนักงาน', categoryCode: '7110', categoryName: 'ครุภัณฑ์สำนักงาน', isBelowThreshold: false, isDonated: false },
  { sheetIndex: 1, sheetName: '2. ครุภัณฑ์สำนักงาน (ต.)', categoryCode: '7110', categoryName: 'ครุภัณฑ์สำนักงาน', isBelowThreshold: true, isDonated: false },
  { sheetIndex: 2, sheetName: '3. ครุภัณฑ์สำนักงาน (บริจาค)', categoryCode: '7110', categoryName: 'ครุภัณฑ์สำนักงาน', isBelowThreshold: true, isDonated: true },
  { sheetIndex: 3, sheetName: '4. ครุภัณฑ์คอมพิวเตอร์', categoryCode: '7440', categoryName: 'ครุภัณฑ์คอมพิวเตอร์', isBelowThreshold: false, isDonated: false },
  { sheetIndex: 4, sheetName: '5. ครุภัณฑ์คอมพิวเตอร์ (ต.)', categoryCode: '7440', categoryName: 'ครุภัณฑ์คอมพิวเตอร์', isBelowThreshold: true, isDonated: false },
  { sheetIndex: 5, sheetName: '6. ครุภัณฑ์คอมพิวเตอร์ (บริจาค)', categoryCode: '7440', categoryName: 'ครุภัณฑ์คอมพิวเตอร์', isBelowThreshold: false, isDonated: true, defaultUnit: 'เครื่อง' },
  { sheetIndex: 6, sheetName: '7. ครุภัณฑ์โฆษณาและเผยแพร่', categoryCode: '7430', categoryName: 'ครุภัณฑ์โฆษณาและเผยแพร่', isBelowThreshold: false, isDonated: false },
  { sheetIndex: 7, sheetName: '8. ครุภัณฑ์โฆษณาและเผยแพร่(ต)', categoryCode: '7430', categoryName: 'ครุภัณฑ์โฆษณาและเผยแพร่', isBelowThreshold: true, isDonated: false },
  { sheetIndex: 8, sheetName: '9. ครุภัณฑ์ไฟฟ้าและวิทยุ', categoryCode: '4120', categoryName: 'ครุภัณฑ์ไฟฟ้าและวิทยุ', isBelowThreshold: false, isDonated: false },
  { sheetIndex: 9, sheetName: '10. ครุภัณฑ์ไฟฟ้าและวิทยุ (ต)', categoryCode: '4120', categoryName: 'ครุภัณฑ์ไฟฟ้าและวิทยุ', isBelowThreshold: true, isDonated: false },
  { sheetIndex: 10, sheetName: '12. ครุภัณฑ์ยานพาหนะและขนส่ง ', categoryCode: '2310', categoryName: 'ยานพาหนะและขนส่ง', isBelowThreshold: false, isDonated: false, defaultUnit: 'คัน' },
  { sheetIndex: 11, sheetName: '13. ครุภัณฑ์การแพทย์ ', categoryCode: '6515', categoryName: 'ครุภัณฑ์การแพทย์', isBelowThreshold: false, isDonated: false, defaultUnit: 'เครื่อง' },
  { sheetIndex: 12, sheetName: '11. ครุภัณฑ์งานบ้านงานครัว ', categoryCode: '7810', categoryName: 'ครุภัณฑ์งานบ้านงานครัว', isBelowThreshold: false, isDonated: false, defaultUnit: 'เครื่อง' },
  { sheetIndex: 13, sheetName: '14. ครุภัณฑ์การแพทย์ (ต)', categoryCode: '6515', categoryName: 'ครุภัณฑ์การแพทย์', isBelowThreshold: false, isDonated: false, defaultUnit: 'เครื่อง' },
]

function cleanCellText(val: any): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object' && val.text) return String(val.text).trim()
  if (typeof val === 'object' && val.result) return String(val.result).trim()
  return String(val).trim()
}

function parseAcquiredDate(rawVal: any): string | null {
  if (!rawVal) return null
  if (rawVal instanceof Date) {
    let yr = rawVal.getFullYear()
    let mo = String(rawVal.getMonth() + 1).padStart(2, '0')
    let da = String(rawVal.getDate()).padStart(2, '0')
    if (yr >= 1950 && yr < 2000) yr = (yr - 1900 + 2500) - 543
    else if (yr >= 2500) yr = yr - 543
    return `${yr}-${mo}-${da}`
  }
  const str = cleanCellText(rawVal)
  if (!str || str === '-') return null
  const yrMatch = str.match(/(?:งปม\.?|ปี\s*)?(\d{4})/i)
  if (yrMatch) {
    let yearNum = parseInt(yrMatch[1], 10)
    if (yearNum >= 2400) yearNum -= 543
    return `${yearNum}-01-01`
  }
  return parseDateThaiBEToISO(str)
}

function extractSerialAndBrand(rawBrandModel: string, rawItemName: string): { brand: string; model: string; serialNo: string | null } {
  const combined = (rawBrandModel + ' ' + rawItemName).trim()
  const snMatch = combined.match(/(?:s\/n|sn|serial(?:\s*no)?)\s*[:\s#]\s*([A-Za-z0-9_-]+)/i)
  const serialNo = snMatch ? snMatch[1].trim() : null
  let cleanBm = rawBrandModel.replace(/\(?(?:s\/n|sn|serial(?:\s*no)?)\s*[:\s#]\s*[A-Za-z0-9_-]+\)?/gi, '').trim()
  return { brand: cleanBm || '', model: '', serialNo }
}

async function runImport() {
  console.log('====================================================')
  console.log('🚀 เริ่มต้นกระบวนการนำเข้าข้อมูลครุภัณฑ์จริง (CAMMS Import Pipeline)')
  console.log('====================================================')

  if (!fs.existsSync('.env.postgres.app')) {
    throw new Error('ไม่พบไฟล์ .env.postgres.app')
  }
  const appEnv = dotenv.parse(fs.readFileSync('.env.postgres.app'))
  const pool = new Pool({ connectionString: appEnv.DATABASE_MIGRATION_URL })
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. ตรวจสอบ/สร้าง Profile Admin
    let adminRes = await client.query("SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1;")
    let adminId = adminRes.rows[0]?.id
    if (!adminId) {
      console.log('▶ สร้างบัญชีผู้ดูแลระบบ (Admin) เริ่มต้น...')
      const insAdmin = await client.query(`
        INSERT INTO public.profiles (full_name, email, role, is_active)
        VALUES ('ผู้ดูแลระบบ (Admin)', 'admin@camms.local', 'admin', true)
        RETURNING id;
      `)
      adminId = insAdmin.rows[0].id

      // ตรวจสอบ password hash
      const adminSecret = 'password'
      const hash = await hashPassword(adminSecret)
      await client.query(`
        INSERT INTO private_auth.credentials (user_id, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash;
      `, [adminId, hash])
      console.log('✔ บัญชี Admin พร้อมใช้งาน: admin@camms.local')
    }

    // 2. โหลดไฟล์ Excel
    const filePath = path.join(process.cwd(), 'docs', 'ทะเบียนครุภัณฑ์ ปีงปม.พ.ศ.2570.xlsx')
    console.log(`▶ กำลังเปิดอ่านไฟล์: ${filePath}`)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(filePath)

    // 3. เตรียมหมวดหมู่ 7 หมวดหมู่หลัก
    console.log('▶ กำลังสร้างหมวดหมู่ครุภัณฑ์มาตรฐาน (Categories)...')
    const categoryMap = new Map<string, string>()
    const categoryMeta: Record<string, { color: string; icon: string }> = {
      'ครุภัณฑ์สำนักงาน': { color: '#3B82F6', icon: 'Armchair' },
      'ครุภัณฑ์คอมพิวเตอร์': { color: '#06B6D4', icon: 'Laptop' },
      'ครุภัณฑ์โฆษณาและเผยแพร่': { color: '#8B5CF6', icon: 'Tv' },
      'ครุภัณฑ์ไฟฟ้าและวิทยุ': { color: '#F59E0B', icon: 'Radio' },
      'ยานพาหนะและขนส่ง': { color: '#10B981', icon: 'Car' },
      'ครุภัณฑ์การแพทย์': { color: '#EC4899', icon: 'Activity' },
      'ครุภัณฑ์งานบ้านงานครัว': { color: '#64748B', icon: 'Package' },
    }

    for (const cfg of SHEET_CONFIGS) {
      if (!categoryMap.has(cfg.categoryName)) {
        const meta = categoryMeta[cfg.categoryName] || { color: '#64748B', icon: 'Tag' }
        const catRes = await client.query(`
          INSERT INTO public.categories (name, item_type, description, color, icon, is_active)
          VALUES ($1, 'asset', $2, $3, $4, true)
          ON CONFLICT (name, item_type) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color, icon = EXCLUDED.icon
          RETURNING id;
        `, [cfg.categoryName, cfg.categoryCode, meta.color, meta.icon])
        categoryMap.set(cfg.categoryName, catRes.rows[0].id)
      }
    }
    console.log(`✔ บันทึกหมวดหมู่สำเร็จ: ${categoryMap.size} หมวดหมู่`)

    // 4. เตรียมแคชหน่วยนับและสถานที่
    const unitMap = new Map<string, string>()
    const locationMap = new Map<string, string>()
    const assetNumbers = new Map<string, number>()
    let insertedCount = 0

    console.log('▶ กำลังนำเข้าข้อมูลครุภัณฑ์และพัสดุจากทั้ง 14 แผ่นงาน...')

    for (const cfg of SHEET_CONFIGS) {
      const ws = wb.worksheets[cfg.sheetIndex]
      let headerRowIdx = 7
      for (let r = 5; r <= 9; r++) {
        if (cleanCellText(ws.getRow(r).getCell(1).value).includes('ลำดับ')) {
          headerRowIdx = r
          break
        }
      }

      const hRow = ws.getRow(headerRowIdx)
      let colDate = -1, colBudget = -1, colName = -1, colBrand = -1, colPrice = -1
      let colUnit = -1, colAsset1 = -1, colAsset2 = -1, colGf = -1, colPerson = -1, colLoc = -1
      let colConditionUsable = -1, colConditionDamaged = -1, colConditionInactive = -1, colNote = -1

      hRow.eachCell((cell, colNumber) => {
        const text = cleanCellText(cell.value)
        if (text.includes('วันเดือนปี')) colDate = colNumber
        else if (text.includes('รับจาก')) colBudget = colNumber
        else if (text.includes('รายการครุภัณฑ์') || text === 'รายการ') colName = colNumber
        else if (text.includes('ยี่ห้อ/รุ่น') || text.includes('ยี่ห้อรุ่น')) colBrand = colNumber
        else if ((text === 'ราคา' || text === 'จำนวนเงิน' || text.includes('ราคาต่อหน่วย') || text === 'มูลค่า') && !text.includes('เสื่อม')) colPrice = colNumber
        else if (text === 'หน่วย' || text === 'หน่วยนับ') colUnit = colNumber
        else if (text.includes('เลขครุภัณฑ์') || text.includes('ทะเบียนกำหนดใหม่')) {
          if (colAsset1 === -1) colAsset1 = colNumber
          else colAsset2 = colNumber
        }
        else if (text.includes('GF') || text.includes('สินทรัพย์')) colGf = colNumber
        else if (text.includes('ผู้ครอบครอง') || text.includes('ผู้รับผิดชอบ')) colPerson = colNumber
        else if (text.includes('สถานที่ใช้งาน') || text.includes('ใช้งานที่') || text.includes('ใช้ประจำที่')) colLoc = colNumber
        else if (text.includes('หมายเหตุ')) colNote = colNumber
      })

      const subHRow = ws.getRow(headerRowIdx + 1)
      subHRow.eachCell((cell, colNumber) => {
        const text = cleanCellText(cell.value)
        if (text.includes('ใช้งานได้')) colConditionUsable = colNumber
        else if (text.includes('ชำรุด')) colConditionDamaged = colNumber
        else if (text.includes('เสื่อมสภาพ')) colConditionInactive = colNumber
        if ((text === 'ราคา' || text === 'จำนวนเงิน') && colPrice === -1) colPrice = colNumber
      })

      const startDataRow = headerRowIdx + (colConditionUsable !== -1 ? 2 : 1)
      let sheetInserted = 0

      for (let r = startDataRow; r <= ws.rowCount; r++) {
        const row = ws.getRow(r)
        const seqVal = row.getCell(1).value
        const isSeq = typeof seqVal === 'number' || (typeof seqVal === 'string' && /^\d+$/.test(seqVal.trim()))
        if (!isSeq) continue

        const rawName = cleanCellText(colName !== -1 ? row.getCell(colName).value : '')
        if (!rawName || rawName === '-' || rawName.includes('รวม')) continue

        const acquiredDate = colDate !== -1 ? parseAcquiredDate(row.getCell(colDate).value) : null
        const budgetSource = colBudget !== -1 ? cleanCellText(row.getCell(colBudget).value) : null
        const rawBrand = colBrand !== -1 ? cleanCellText(row.getCell(colBrand).value) : ''
        const { brand, model, serialNo } = extractSerialAndBrand(rawBrand, rawName)

        let rawPrice = colPrice !== -1 ? row.getCell(colPrice).value : null
        let unitPrice: number | null = null
        if (typeof rawPrice === 'number') unitPrice = rawPrice
        else if (rawPrice) {
          const numClean = cleanCellText(rawPrice).replace(/,/g, '')
          const parsedP = parseFloat(numClean)
          unitPrice = isNaN(parsedP) || parsedP < 0 ? null : parsedP
        }

        let unitName = colUnit !== -1 ? cleanCellText(row.getCell(colUnit).value) : ''
        if (unitName === 'ตว') unitName = 'ตัว'
        if (!unitName && cfg.defaultUnit) unitName = cfg.defaultUnit
        if (!unitName) unitName = 'ชุด'

        // บันทึก/ค้นหา Unit
        let unitId = unitMap.get(unitName)
        if (!unitId) {
          const uRes = await client.query(`
            INSERT INTO public.units (name, is_active)
            VALUES ($1, true)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id;
          `, [unitName])
          unitId = uRes.rows[0].id as string
          unitMap.set(unitName, unitId)
        }

        let prefix = colAsset1 !== -1 ? cleanCellText(row.getCell(colAsset1).value) : ''
        let suffix = colAsset2 !== -1 ? cleanCellText(row.getCell(colAsset2).value) : ''
        let assetNo: string | null = null
        if (prefix && suffix) assetNo = `${prefix} ${suffix}`.trim()
        else if (prefix) assetNo = prefix
        else if (suffix) assetNo = suffix
        if (assetNo === '-' || !assetNo) assetNo = null

        let noteSuffix = ''
        if (assetNo) {
          const count = assetNumbers.get(assetNo) || 0
          assetNumbers.set(assetNo, count + 1)
          if (count > 0) {
            const rawAssetNo = assetNo
            if (rawName.includes('จอ') || rawBrand.includes('จอ')) {
              assetNo = `${assetNo} (จอ)`
            } else {
              assetNo = `${assetNo} (ชิ้นที่ ${count + 1})`
            }
            noteSuffix = ` [เลขทะเบียนต้นฉบับ: ${rawAssetNo} - ซื้อเป็นชุดร่วม]`
          }
        }

        const gfmis = colGf !== -1 ? cleanCellText(row.getCell(colGf).value) : null
        let responsiblePerson = colPerson !== -1 ? cleanCellText(row.getCell(colPerson).value) : null
        if (responsiblePerson === '-' || !responsiblePerson) responsiblePerson = null

        let locationName = colLoc !== -1 ? cleanCellText(row.getCell(colLoc).value) : ''
        if (locationName === '-' || !locationName) locationName = 'สำนักงานเขตสุขภาพที่ 7'

        // บันทึก/ค้นหา Location
        let locationId = locationMap.get(locationName)
        if (!locationId) {
          const lRes = await client.query(`
            INSERT INTO public.locations (name, is_active)
            VALUES ($1, true)
            RETURNING id;
          `, [locationName])
          locationId = lRes.rows[0].id as string
          locationMap.set(locationName, locationId)
        }

        let status: 'active' | 'damaged' | 'inactive' = 'active'
        const isDamaged = colConditionDamaged !== -1 && ['/', '✓', 'x', '1'].includes(cleanCellText(row.getCell(colConditionDamaged).value).toLowerCase())
        const isInactive = colConditionInactive !== -1 && ['/', '✓', 'x', '1'].includes(cleanCellText(row.getCell(colConditionInactive).value).toLowerCase())
        if (isDamaged) status = 'damaged'
        else if (isInactive) status = 'inactive'

        let note = colNote !== -1 ? cleanCellText(row.getCell(colNote).value) : null
        if (noteSuffix) {
          note = (note ? note + noteSuffix : noteSuffix).trim()
        }

        // The source workbook is an asset register in both threshold groups.
        // Qualification is not the same dimension as the CAMMS asset/material type.
        const itemType = 'asset'
        const qualificationStatus = cfg.isBelowThreshold === null ? null : cfg.isBelowThreshold ? 'below_threshold' : 'qualified'
        const categoryId = categoryMap.get(cfg.categoryName)

        // Insert Item with ON CONFLICT DO NOTHING for duplicate asset_no
        await client.query(`
          INSERT INTO public.items (
            item_name, item_type, qualification_status, category_id, location_id, unit_id,
            quantity, unit_price, asset_no, serial_no, brand, model,
            responsible_person, status, note, budget_source, gfmis_number,
            acquired_date, created_by, depreciation_enabled
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17,
            $18, $19, false
          )
          ON CONFLICT (asset_no) WHERE deleted_at IS NULL AND asset_no IS NOT NULL
          DO UPDATE SET qualification_status = EXCLUDED.qualification_status
          WHERE public.items.qualification_status IS DISTINCT FROM EXCLUDED.qualification_status;
        `, [
          normalizeForStorage(rawName), itemType, qualificationStatus, categoryId, locationId, unitId,
          1, unitPrice, assetNo ? normalizeForStorage(assetNo) : null,
          serialNo ? normalizeForStorage(serialNo) : null,
          brand ? normalizeForStorage(brand) : null,
          model ? normalizeForStorage(model) : null,
          responsiblePerson ? normalizeForStorage(responsiblePerson) : null,
          status, note ? normalizeForStorage(note) : null,
          budgetSource ? normalizeForStorage(budgetSource) : null,
          gfmis ? normalizeForStorage(gfmis) : null,
          acquiredDate, adminId
        ])

        sheetInserted++
        insertedCount++
      }
      console.log(`  • แผ่นงาน ${cfg.sheetName}: นำเข้าสำเร็จ ${sheetInserted} รายการ`)
    }

    await client.query('COMMIT')
    console.log('====================================================')
    console.log(`🎉 นำเข้าข้อมูลจริงสำเร็จสมบูรณ์ครบถ้วนทั้งสิ้น ${insertedCount} รายการ!`)
    console.log(`✔ หมวดหมู่: ${categoryMap.size} หมวด`)
    console.log(`✔ หน่วยนับ: ${unitMap.size} หน่วย`)
    console.log(`✔ สถานที่จัดตั้ง: ${locationMap.size} จุด`)
    console.log('====================================================')

  } catch (err: any) {
    await client.query('ROLLBACK')
    console.error('❌ เกิดข้อผิดพลาดในการนำเข้า:', err.message)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

runImport().catch(console.error)
