import { Pool } from 'pg'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { normalizeForStorage } from '../lib/unicode'

config({ path: resolve(process.cwd(), '.env.postgres.app') })

// SAFETY CHECK: Ensure we ONLY run against local/development database
const connStr = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL
if (!connStr) {
  throw new Error('Database connection string is missing!')
}
const parsedUrl = new URL(connStr)
if (parsedUrl.hostname !== '127.0.0.1' && parsedUrl.hostname !== 'localhost') {
  throw new Error(`SAFETY ABORT: Attempted to run multi-year seed against non-local host: ${parsedUrl.hostname}`)
}

const pool = new Pool({ connectionString: connStr })

const MOCK_TAG = '[MOCK-MULTIYEAR]'

async function seedMultiYear() {
  const client = await pool.connect()
  try {
    console.log('--- Starting Multi-Year Mock Data Seeding (B.E. 2565 - 2575) ---')

    // 1. Fetch metadata
    const catRows = (await client.query('SELECT id, name, item_type FROM public.categories')).rows
    const assetCategories = catRows.filter(c => c.item_type === 'asset')
    const materialCategories = catRows.filter(c => c.item_type === 'material')

    const locRows = (await client.query('SELECT id, name FROM public.locations')).rows
    const unitRows = (await client.query('SELECT id, name FROM public.units')).rows
    const profRows = (await client.query('SELECT id, full_name, role FROM public.profiles WHERE is_active = true')).rows

    const adminUser = profRows.find(p => p.role === 'admin') || profRows[0]
    const normalUser = profRows.find(p => p.role === 'user') || adminUser

    const getUnit = (nameSnippet: string) => unitRows.find(u => u.name.includes(nameSnippet))?.id || unitRows[0].id
    const getAssetCat = (nameSnippet: string) => assetCategories.find(c => c.name.includes(nameSnippet))?.id || assetCategories[0].id
    const getMatCat = (nameSnippet: string) => materialCategories.find(c => c.name.includes(nameSnippet))?.id || materialCategories[0].id

    // 2. Clean up existing mock data cleanly (Idempotency)
    console.log('Cleaning up any previous mock data tagged with', MOCK_TAG, '...')
    await client.query("SET session_replication_role = 'replica'")

    await client.query(`
      DELETE FROM public.asset_custody_logs 
      WHERE note LIKE '%[MOCK-MULTIYEAR]%' 
         OR disbursement_item_id IN (
           SELECT di.id FROM public.disbursement_items di 
           JOIN public.disbursements d ON d.id = di.disbursement_id 
           WHERE d.document_no LIKE 'DIS-MOCK-%' OR d.purpose LIKE '%[MOCK-MULTIYEAR]%'
         )
    `)

    await client.query(`
      DELETE FROM public.stock_movements 
      WHERE item_id IN (SELECT id FROM public.materials WHERE note LIKE '%[MOCK-MULTIYEAR]%')
         OR disbursement_item_id IN (
           SELECT di.id FROM public.disbursement_items di 
           JOIN public.disbursements d ON d.id = di.disbursement_id 
           WHERE d.document_no LIKE 'DIS-MOCK-%' OR d.purpose LIKE '%[MOCK-MULTIYEAR]%'
         )
    `)

    await client.query(`
      DELETE FROM public.material_stock_documents 
      WHERE reference LIKE 'MOCK-%' OR reason LIKE '%[MOCK-MULTIYEAR]%'
    `)

    await client.query(`
      DELETE FROM public.disbursement_items 
      WHERE disbursement_id IN (
        SELECT id FROM public.disbursements 
        WHERE document_no LIKE 'DIS-MOCK-%' OR purpose LIKE '%[MOCK-MULTIYEAR]%'
      )
    `)

    await client.query(`
      DELETE FROM public.disbursements 
      WHERE document_no LIKE 'DIS-MOCK-%' OR purpose LIKE '%[MOCK-MULTIYEAR]%'
    `)

    await client.query(`
      DELETE FROM public.disbursement_sequences 
      WHERE prefix = 'DIS-MOCK'
    `)

    await client.query(`
      DELETE FROM public.items 
      WHERE asset_no LIKE 'MOCK-A-%' OR note LIKE '%[MOCK-MULTIYEAR]%'
    `)

    await client.query(`
      DELETE FROM public.materials 
      WHERE commodity_code LIKE 'MOCK-MAT-%' OR note LIKE '%[MOCK-MULTIYEAR]%'
    `)

    await client.query(`
      DELETE FROM public.audit_logs 
      WHERE action LIKE '%[MOCK-MULTIYEAR]%' 
         OR old_data::text LIKE '%[MOCK-MULTIYEAR]%' 
         OR new_data::text LIKE '%[MOCK-MULTIYEAR]%'
    `)

    // Turn back to origin mode so items/materials triggers populate inventory_registry properly
    await client.query("SET session_replication_role = 'origin'")
    console.log('Previous mock data cleared successfully.')

    // Track seeded records per year for reporting
    const stats: Record<number, { assets: number; materials: number; disbursements: number; totalValue: number }> = {}
    for (let y = 2565; y <= 2575; y++) {
      stats[y] = { assets: 0, materials: 0, disbursements: 0, totalValue: 0 }
    }

    // Map of seeded items per year for disbursements
    const seededAssetsByYear = new Map<number, Array<{ id: string; name: string; assetNo: string; unitPrice: number; categoryName: string; locationName: string; unitName: string }>>()
    const seededMaterialsByYear = new Map<number, Array<{ id: string; name: string; unitPrice: number; categoryName: string; locationName: string; unitName: string; quantity: number }>>()

    // Define configuration for each of the 11 years (2565 - 2575)
    // Gregorian calendar equivalent:
    // FY 2565: Oct 2021 - Sep 2022
    // FY 2566: Oct 2022 - Sep 2023
    // FY 2567: Oct 2023 - Sep 2024 (Sparse year: 1 asset, 1 material, 0 disbursements)
    // FY 2568: Oct 2024 - Sep 2025 (High volume year: 55 assets, 45 materials, 30 disbursements)
    // FY 2569: Oct 2025 - Sep 2026
    // FY 2570: Oct 2026 - Sep 2027 (Current Year: 10 assets, 8 materials, 10 disbursements)
    // FY 2571: Oct 2027 - Sep 2028
    // FY 2572: Oct 2028 - Sep 2029
    // FY 2573: Oct 2029 - Sep 2030 (EMPTY YEAR: 0 assets, 0 materials, 0 disbursements)
    // FY 2574: Oct 2030 - Sep 2031
    // FY 2575: Oct 2031 - Sep 2032

    const yearConfigs: Array<{
      fy: number
      ceYear: number // middle of fiscal year (spring/summer)
      assetCount: number
      materialCount: number
      disbursementCount: number
    }> = [
      { fy: 2565, ceYear: 2022, assetCount: 6, materialCount: 6, disbursementCount: 5 },
      { fy: 2566, ceYear: 2023, assetCount: 8, materialCount: 8, disbursementCount: 6 },
      { fy: 2567, ceYear: 2024, assetCount: 1, materialCount: 1, disbursementCount: 0 }, // Sparse year
      { fy: 2568, ceYear: 2025, assetCount: 55, materialCount: 45, disbursementCount: 30 }, // High volume
      { fy: 2569, ceYear: 2026, assetCount: 15, materialCount: 12, disbursementCount: 12 },
      { fy: 2570, ceYear: 2027, assetCount: 10, materialCount: 8, disbursementCount: 10 }, // Current year
      { fy: 2571, ceYear: 2028, assetCount: 8, materialCount: 6, disbursementCount: 4 },
      { fy: 2572, ceYear: 2029, assetCount: 6, materialCount: 5, disbursementCount: 3 },
      { fy: 2573, ceYear: 2030, assetCount: 0, materialCount: 0, disbursementCount: 0 }, // EMPTY YEAR
      { fy: 2574, ceYear: 2031, assetCount: 4, materialCount: 4, disbursementCount: 2 },
      { fy: 2575, ceYear: 2032, assetCount: 6, materialCount: 5, disbursementCount: 2 },
    ]

    // Sample data templates
    const assetNames = [
      { name: 'เครื่องคอมพิวเตอร์ประมวลผล All-in-One', cat: 'คอมพิวเตอร์', price: 32000, brand: 'Dell', model: 'OptiPlex 7400', useful: 5 },
      { name: 'เครื่องพิมพ์เลเซอร์มัลติฟังก์ชันเน็ตเวิร์ก', cat: 'คอมพิวเตอร์', price: 18500, brand: 'HP', model: 'LaserJet Pro M428fdw', useful: 5 },
      { name: 'จอแสดงผล LED ขนาด 27 นิ้ว 4K', cat: 'คอมพิวเตอร์', price: 9500, brand: 'LG', model: '27UP850-W', useful: 5 },
      { name: 'คอมพิวเตอร์พกพาสำหรับงานบริหาร (Laptop)', cat: 'คอมพิวเตอร์', price: 42000, brand: 'Lenovo', model: 'ThinkPad T14', useful: 5 },
      { name: 'โต๊ะทำงานผู้บริหารไม้เมลามีนพร้อมตู้ข้าง', cat: 'สำนักงาน', price: 14500, brand: 'Modernform', model: 'EX-180', useful: 10 },
      { name: 'เก้าอี้ทำงานพนักพิงสูงระดับบริหาร (Ergonomic)', cat: 'สำนักงาน', price: 6800, brand: 'Ergohuman', model: 'Elite Plus', useful: 8 },
      { name: 'ตู้เหล็กเก็บเอกสาร 4 ลิ้นชัก รางลูกปืน', cat: 'สำนักงาน', price: 5400, brand: 'Lucky World', model: 'KCD-4', useful: 10 },
      { name: 'ตู้เซฟนิรภัยกันไฟ 2 กุญแจ 1 รหัสหมุน', cat: 'สำนักงาน', price: 24000, brand: 'Chubbsafes', model: 'King Cobra 65', useful: 15 },
      { name: 'เครื่องฟอกอากาศประสิทธิภาพสูงห้องประชุม', cat: 'ไฟฟ้า', price: 12900, brand: 'Daikin', model: 'MCK55W', useful: 5 },
      { name: 'เครื่องปรับอากาศแบบติดผนัง Inverter 24000 BTU', cat: 'ไฟฟ้า', price: 34500, brand: 'Mitsubishi Electric', model: 'MSY-JS24VF', useful: 7 },
      { name: 'โปรเจคเตอร์เลเซอร์ความสว่างสูง 5000 Lumens', cat: 'โฆษณา', price: 48000, brand: 'Epson', model: 'EB-L520U', useful: 5 },
      { name: 'จอโทรทัศน์ Smart LED Display 65 นิ้ว', cat: 'โฆษณา', price: 26900, brand: 'Samsung', model: 'QA65Q60B', useful: 5 },
      { name: 'เครื่องสแกนอัลตราซาวด์ระบบดิจิทัลเคลื่อนที่', cat: 'การแพทย์', price: 280000, brand: 'GE Healthcare', model: 'Versana Active', useful: 7 },
      { name: 'เครื่องวัดสัญญาณชีพผู้ป่วยข้างเตียง (Vital Signs)', cat: 'การแพทย์', price: 65000, brand: 'Mindray', model: 'iMEC 8', useful: 7 },
      { name: 'ตู้เย็นเก็บตัวอย่างชีวภาพ 2 ประตู 18.5 คิว', cat: 'งานบ้าน', price: 22500, brand: 'Panasonic', model: 'NR-BX471C', useful: 8 },
      { name: 'ไมโครเวฟดิจิทัลสำหรับห้องพักบุคลากร', cat: 'งานบ้าน', price: 3800, brand: 'Sharp', model: 'R-2200F-S', useful: 5 },
      { name: 'รถยนต์ส่วนกลางตรวจการ 4 ประตู ขับเคลื่อน 4 ล้อ', cat: 'ยานพาหนะ', price: 890000, brand: 'Toyota', model: 'Hilux Revo Double Cab', useful: 10 },
    ]

    const materialNames = [
      { name: 'กระดาษพิมพ์เขียนถ่ายเอกสาร A4 80 แกรม', cat: 'สำนักงาน', price: 135, unit: 'รีม', spec: '80 แกรม 500 แผ่น/รีม ขาวพิเศษ' },
      { name: 'แฟ้มสันกว้าง 3 นิ้ว ตราช้าง 120F', cat: 'สำนักงาน', price: 78, unit: 'เล่ม', spec: 'สันกว้าง 3 นิ้ว ห่วงเหล็กเคลือบนิกเกิล' },
      { name: 'ปากกาเน้นข้อความคละสี ชุด 4 ด้าม', cat: 'สำนักงาน', price: 65, unit: 'ชุด', spec: 'หมึกสูตรน้ำ ไร้กลิ่นฉุน ชนิดหัวตัด' },
      { name: 'ลวดเย็บกระดาษ เบอร์ 10 ตราช้าง', cat: 'สำนักงาน', price: 12, unit: 'กล่อง', spec: 'เหล็กชุบสังกะสี ไม่เป็นสนิม 1000 ตัว/กล่อง' },
      { name: 'ตลับผงหมึกเลเซอร์สีดำ HP CF283A (83A)', cat: 'คอมพิวเตอร์', price: 2350, unit: 'กล่อง', spec: 'ตลับหมึกแท้ OEM พิมพ์ได้ 1,500 แผ่น' },
      { name: 'หมึกเติมเครื่องพิมพ์ขวด EPSON 003 สีดำ', cat: 'คอมพิวเตอร์', price: 250, unit: 'ขวด', spec: 'หมึกแท้ชนิด Dye พิมพ์เอกสารคมชัด 65ml' },
      { name: 'สายแลนสำเร็จรูป Cat6 UTP ยาว 3 เมตร', cat: 'คอมพิวเตอร์', price: 95, unit: 'ชุด', spec: 'สายทองแดงแท้ 100% รองรับกิกะบิต 1Gbps' },
      { name: 'แฟลชไดรฟ์ USB 3.2 ความจุ 64GB', cat: 'คอมพิวเตอร์', price: 220, unit: 'อัน', spec: 'ความเร็วอ่าน 100MB/s หัวเลื่อนกันกระแทก' },
      { name: 'เจลแอลกอฮอล์ทำความสะอาดมือ 75% ขนาด 450 มล.', cat: 'งานบ้าน', price: 85, unit: 'ขวด', spec: 'แอลกอฮอล์กลิ่นหอม แห้งเร็ว ถนอมผิว' },
      { name: 'กระดาษชำระม้วนใหญ่ JRT 2 ชั้น 300 เมตร', cat: 'งานบ้าน', price: 72, unit: 'ม้วน', spec: 'เยื่อกระดาษบริสุทธิ์ 100% ย่อยสลายง่าย' },
      { name: 'ถุงขยะดำความหนาพิเศษ ขนาด 30x40 นิ้ว', cat: 'งานบ้าน', price: 48, unit: 'ห่อ', spec: 'พลาสติก HDPE เหนียวทน บรรจุ 10 ใบ/ห่อ' },
      { name: 'ถ่านอัลคาไลน์ AA Panasonic Alkaline (แพ็ก 4 ก้อน)', cat: 'โฆษณา', price: 99, unit: 'ชุด', spec: 'แรงดัน 1.5V จ่ายไฟสม่ำเสมอ ไร้สารปรอท' },
      { name: 'กระดาษกลอสซี่พิมพ์ภาพถ่ายขนาด A4 (20 แผ่น)', cat: 'โฆษณา', price: 160, unit: 'ห่อ', spec: 'กระดาษเคลือบพิเศษเงาด้านเดียว 210 แกรม' },
    ]

    // 3. Insert Items (Assets) for each year
    console.log('Inserting Durable Assets (ครุภัณฑ์) across fiscal years...')
    for (const config of yearConfigs) {
      if (config.assetCount === 0) continue
      const yearAssets: Array<{ id: string; name: string; assetNo: string; unitPrice: number; categoryName: string; locationName: string; unitName: string }> = []

      for (let i = 1; i <= config.assetCount; i++) {
        const tmpl = assetNames[(i - 1) % assetNames.length]
        const catId = getAssetCat(tmpl.cat)
        const locId = locRows[(i + config.fy) % locRows.length].id
        const locName = locRows[(i + config.fy) % locRows.length].name
        const unitId = getUnit('เครื่อง')
        const unitName = 'เครื่อง'

        // Status distribution: mostly active, some spare, damaged, disposed
        let status: 'active' | 'spare' | 'damaged' | 'waiting_repair' | 'inactive' | 'disposed' = 'active'
        if (config.fy <= 2566 && i % 3 === 0) status = 'disposed'
        else if (i % 7 === 0) status = 'damaged'
        else if (i % 9 === 0) status = 'waiting_repair'
        else if (i % 5 === 0) status = 'spare'

        // Date calculation within the fiscal year
        // e.g. FY 2568 (Oct 2024 - Sep 2025): month = ((i % 12) + 1), year = (month >= 10 ? config.ceYear - 1 : config.ceYear)
        const monthNum = ((i * 2) % 12) + 1
        const calYear = monthNum >= 10 ? config.ceYear - 1 : config.ceYear
        const dayNum = Math.min(28, (i * 3) % 28 + 1)
        const dateStr = `${calYear}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`

        const seqStr = String(i).padStart(4, '0')
        const assetNo = `MOCK-A-${config.fy}-${seqStr}`
        const serialNo = `MOCK-SN-${config.fy}-${seqStr}`
        const unitPrice = tmpl.price + (i % 5) * 500

        const enableDeprec = unitPrice > 5000 && status !== 'disposed'
        const usefulLife = tmpl.useful

        const res = await client.query(`
          INSERT INTO public.items (
            item_name, item_type, category_id, location_id, unit_id, quantity, unit_price,
            asset_no, serial_no, brand, model, responsible_person, status,
            note, budget_source, acquired_date,
            depreciation_enabled, depreciation_method, depreciation_cost,
            depreciation_useful_life_years, depreciation_start_basis, depreciation_start_date, depreciation_residual_value,
            qualification_status, is_central, created_by, updated_by
          ) VALUES (
            $1, 'asset', $2, $3, $4, 1, $5,
            $6, $7, $8, $9, $10, $11,
            $12, $13, $14,
            $15, $16, $17,
            $18, $19, $20, 1,
            'qualified', true, $21, $21
          ) RETURNING id
        `, [
          normalizeForStorage(tmpl.name),
          catId,
          locId,
          unitId,
          unitPrice,
          assetNo,
          serialNo,
          tmpl.brand,
          tmpl.model,
          adminUser.full_name,
          status,
          normalizeForStorage(`${MOCK_TAG} ครุภัณฑ์ปีงบประมาณ ${config.fy}`),
          normalizeForStorage(`งบประมาณแผ่นดิน ปี ${config.fy}`),
          dateStr,
          enableDeprec,
          enableDeprec ? 'straight_line' : null,
          enableDeprec ? unitPrice : null,
          enableDeprec ? usefulLife : null,
          enableDeprec ? 'acquired' : null,
          enableDeprec ? dateStr : null,
          adminUser.id
        ])

        const itemId = res.rows[0].id
        yearAssets.push({
          id: itemId,
          name: tmpl.name,
          assetNo,
          unitPrice,
          categoryName: tmpl.cat,
          locationName: locName,
          unitName
        })
        stats[config.fy].assets++
        stats[config.fy].totalValue += unitPrice
      }
      seededAssetsByYear.set(config.fy, yearAssets)
    }

    // 4. Insert Materials (วัสดุ) for each year
    console.log('Inserting Consumable Materials (วัสดุ) across fiscal years...')
    for (const config of yearConfigs) {
      if (config.materialCount === 0) continue
      const yearMaterials: Array<{ id: string; name: string; unitPrice: number; categoryName: string; locationName: string; unitName: string; quantity: number }> = []

      for (let i = 1; i <= config.materialCount; i++) {
        const tmpl = materialNames[(i - 1) % materialNames.length]
        const catId = getMatCat(tmpl.cat)
        const locId = locRows[(i + config.fy * 2) % locRows.length].id
        const locName = locRows[(i + config.fy * 2) % locRows.length].name
        const unitId = getUnit(tmpl.unit)

        const monthNum = ((i * 3) % 12) + 1
        const calYear = monthNum >= 10 ? config.ceYear - 1 : config.ceYear
        const dayNum = Math.min(28, (i * 2) % 28 + 1)
        const asOfDate = `${calYear}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`

        const seqStr = String(i).padStart(4, '0')
        const commodityCode = `MOCK-MAT-${config.fy}-${seqStr}`
        const unitPrice = tmpl.price

        // Ledger quantities
        const openingQty = 20 + (i % 5) * 10
        const receivedQty = (i % 4) * 15
        const issuedQty = Math.floor((openingQty + receivedQty) * 0.4)
        const balanceQty = openingQty + receivedQty - issuedQty

        const openingAmount = openingQty * unitPrice
        const receivedAmount = receivedQty * unitPrice
        const issuedAmount = issuedQty * unitPrice
        const balanceAmount = balanceQty * unitPrice

        let status: 'active' | 'spare' | 'damaged' | 'inactive' = 'active'
        if (config.fy <= 2566 && i % 4 === 0) status = 'inactive'
        else if (i % 6 === 0) status = 'spare'
        else if (i % 11 === 0) status = 'damaged'

        const res = await client.query(`
          INSERT INTO public.materials (
            item_name, item_type, category_id, location_id, unit_id, quantity, unit_price,
            specification, commodity_code, fiscal_year, balance_as_of,
            minimum_quantity, maximum_quantity,
            opening_quantity, opening_amount,
            received_quantity, received_amount,
            issued_quantity, issued_amount,
            balance_amount,
            status, note, is_central, created_by, updated_by
          ) VALUES (
            $1, 'material', $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            5, 100,
            $11, $12,
            $13, $14,
            $15, $16,
            $17,
            $18, $19, true, $20, $20
          ) RETURNING id
        `, [
          normalizeForStorage(`${tmpl.name} (รุ่น ${config.fy})`),
          catId,
          locId,
          unitId,
          balanceQty,
          unitPrice,
          normalizeForStorage(tmpl.spec),
          commodityCode,
          config.fy,
          asOfDate,
          openingQty,
          openingAmount,
          receivedQty,
          receivedAmount,
          issuedQty,
          issuedAmount,
          balanceAmount,
          status,
          normalizeForStorage(`${MOCK_TAG} บัญชีวัสดุปีงบประมาณ ${config.fy}`),
          adminUser.id
        ])

        const matId = res.rows[0].id
        yearMaterials.push({
          id: matId,
          name: `${tmpl.name} (รุ่น ${config.fy})`,
          unitPrice,
          categoryName: tmpl.cat,
          locationName: locName,
          unitName: tmpl.unit,
          quantity: balanceQty
        })
        stats[config.fy].materials++
        stats[config.fy].totalValue += balanceAmount
      }
      seededMaterialsByYear.set(config.fy, yearMaterials)
    }

    // 5. Insert Disbursements (การเบิก-จ่าย และการยืม-คืน) across years
    console.log('Inserting Disbursements (การเบิกจ่ายและยืมคืน) across fiscal years...')
    // Enable replica mode for clean multi-year disbursement insertion to bypass application state machine triggers on historic data
    await client.query("SET session_replication_role = 'replica'")

    const departments = ['กลุ่มงานบริหารทั่วไป', 'กลุ่มงานการเงินและบัญชี', 'กลุ่มงานยุทธศาสตร์', 'กลุ่มงานสารสนเทศ', 'กลุ่มงานวิชาการ']
    const purposes = [
      'เพื่อใช้ในการปฏิบัติราชการประจำวัน',
      'สำหรับโครงการฝึกอบรมเชิงปฏิบัติการ',
      'เพื่อเตรียมความพร้อมรับการตรวจราชการ',
      'ใช้สนับสนุนงานประชุมคณะกรรมการบริหาร',
      'สำหรับงานประสานงานหน่วยงานภายนอก'
    ]

    for (const config of yearConfigs) {
      if (config.disbursementCount === 0) continue
      const availableMats = seededMaterialsByYear.get(config.fy) || []
      const availableAssets = seededAssetsByYear.get(config.fy) || []

      for (let i = 1; i <= config.disbursementCount; i++) {
        const seqVal = i
        const docNo = `DIS-MOCK-${config.fy}-${String(seqVal).padStart(4, '0')}`
        const dept = departments[(i - 1) % departments.length]
        const purpose = `${MOCK_TAG} ${purposes[(i - 1) % purposes.length]} ประจำปีงบประมาณ ${config.fy}`

        // Decide transaction type and status based on year and index
        let txType: 'material_issue' | 'asset_handover' | 'asset_borrow' = 'material_issue'
        let status: 'draft' | 'pending_approval' | 'confirmed' | 'active_borrow' | 'returned' | 'reversed' | 'rejected' = 'confirmed'

        if (i % 3 === 0) {
          txType = 'asset_borrow'
          if (config.fy <= 2568) status = 'returned'
          else if (config.fy === 2569) status = i % 2 === 0 ? 'returned' : 'active_borrow'
          else if (config.fy === 2570) status = i % 2 === 0 ? 'active_borrow' : 'pending_approval'
          else status = 'draft'
        } else if (i % 5 === 0) {
          txType = 'asset_handover'
          status = config.fy <= 2570 ? 'confirmed' : 'draft'
        } else {
          txType = 'material_issue'
          if (config.fy <= 2569) status = i % 9 === 0 ? 'reversed' : 'confirmed'
          else if (config.fy === 2570) status = i % 4 === 0 ? 'pending_approval' : i % 7 === 0 ? 'draft' : 'confirmed'
          else status = i % 2 === 0 ? 'draft' : 'pending_approval'
        }

        // Calculate dates
        const monthNum = ((i * 2) % 12) + 1
        const calYear = monthNum >= 10 ? config.ceYear - 1 : config.ceYear
        const dayNum = Math.min(25, (i * 3) % 25 + 1)
        const dateStr = `${calYear}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
        const ts = `${dateStr} 09:30:00+07`
        const returnDue = `${calYear}-${String(Math.min(12, monthNum + 1)).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`

        const isCompleted = ['confirmed', 'active_borrow', 'returned', 'reversed'].includes(status)
        const submittedAt = status !== 'draft' ? ts : null
        const confirmedAt = isCompleted ? ts : null
        const handedOverAt = isCompleted ? ts : null
        const confirmedBy = isCompleted ? adminUser.id : null
        const handedOverBy = isCompleted ? adminUser.id : null

        const disRes = await client.query(`
          INSERT INTO public.disbursements (
            document_no, fiscal_year, transaction_type, recipient_name, department_name,
            purpose, status, due_date,
            submitted_at, confirmed_at, confirmed_by, handed_over_at, handed_over_by,
            created_by, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8,
            $9, $10, $11, $12, $13,
            $14, $15, $15
          ) RETURNING id
        `, [
          docNo,
          config.fy,
          txType,
          normalizeForStorage(normalUser.full_name),
          normalizeForStorage(dept),
          normalizeForStorage(purpose),
          status,
          txType === 'asset_borrow' ? returnDue : null,
          submittedAt,
          confirmedAt,
          confirmedBy,
          handedOverAt,
          handedOverBy,
          normalUser.id,
          ts
        ])
        const disId = disRes.rows[0].id

        // Attach lines to disbursement
        if (txType === 'material_issue' && availableMats.length > 0) {
          const mat = availableMats[(i - 1) % availableMats.length]
          const reqQty = 2 + (i % 4)
          const issueQty = isCompleted ? reqQty : 0
          const lineStatus = isCompleted ? (status === 'reversed' ? 'reversed' : 'issued') : 'pending'

          const itemRes = await client.query(`
            INSERT INTO public.disbursement_items (
              disbursement_id, item_id, requested_qty, issued_qty, returned_qty,
              item_name_snapshot, unit_name_snapshot, unit_price_snapshot,
              category_name_snapshot, location_name_snapshot, status
            ) VALUES (
              $1, $2, $3, $4, 0,
              $5, $6, $7,
              $8, $9, $10
            ) RETURNING id
          `, [
            disId, mat.id, reqQty, issueQty,
            mat.name, mat.unitName, mat.unitPrice,
            mat.categoryName, mat.locationName, lineStatus
          ])

          if (isCompleted && status !== 'reversed') {
            await client.query(`
              INSERT INTO public.stock_movements (
                item_id, disbursement_item_id, delta, balance_after, movement_type, created_by, created_at
              ) VALUES ($1, $2, $3, $4, 'issue', $5, $6)
            `, [
              mat.id, itemRes.rows[0].id, -issueQty, Math.max(0, mat.quantity - issueQty), adminUser.id, ts
            ])
          }
        } else if (availableAssets.length > 0) {
          const asset = availableAssets[(i - 1) % availableAssets.length]
          const issueQty = isCompleted ? 1 : 0
          const returnedQty = status === 'returned' ? 1 : 0
          const lineStatus = status === 'returned' ? 'returned' : isCompleted ? 'issued' : 'pending'

          const itemRes = await client.query(`
            INSERT INTO public.disbursement_items (
              disbursement_id, item_id, requested_qty, issued_qty, returned_qty,
              item_name_snapshot, asset_no_snapshot, unit_name_snapshot, unit_price_snapshot,
              category_name_snapshot, location_name_snapshot, status
            ) VALUES (
              $1, $2, 1, $3, $4,
              $5, $6, $7, $8,
              $9, $10, $11
            ) RETURNING id
          `, [
            disId, asset.id, issueQty, returnedQty,
            asset.name, asset.assetNo, asset.unitName, asset.unitPrice,
            asset.categoryName, asset.locationName, lineStatus
          ])

          if (isCompleted) {
            await client.query(`
              INSERT INTO public.asset_custody_logs (
                item_id, disbursement_item_id, action, quantity, from_responsible, to_responsible, item_condition, note, created_by, created_at
              ) VALUES ($1, $2, $3, 1, $4, $5, 'normal', $6, $7, $8)
            `, [
              asset.id, itemRes.rows[0].id, txType === 'asset_borrow' ? 'borrow' : 'handover',
              'กองพัสดุกลาง', normalUser.full_name, MOCK_TAG, adminUser.id, ts
            ])

            if (status === 'returned') {
              await client.query(`
                INSERT INTO public.asset_custody_logs (
                  item_id, disbursement_item_id, action, quantity, from_responsible, to_responsible, item_condition, note, created_by, created_at
                ) VALUES ($1, $2, 'return', 1, $3, $4, 'normal', $5, $6, $7)
              `, [
                asset.id, itemRes.rows[0].id, normalUser.full_name, 'กองพัสดุกลาง', MOCK_TAG, adminUser.id, `${dateStr} 16:00:00+07`
              ])
            }
          }
        }

        stats[config.fy].disbursements++
      }

      // Ensure sequence tracking for this fiscal year
      await client.query(`
        INSERT INTO public.disbursement_sequences (fiscal_year, prefix, current_val)
        VALUES ($1, 'DIS-MOCK', $2)
        ON CONFLICT (fiscal_year, prefix) DO UPDATE SET current_val = $2
      `, [config.fy, config.disbursementCount])
    }

    // 6. Insert audit logs
    console.log('Inserting sample audit log entries...')
    for (const config of yearConfigs) {
      if (config.assetCount === 0 && config.materialCount === 0) continue
      const dateStr = `${config.ceYear}-02-15 10:00:00+07`
      await client.query(`
        INSERT INTO public.audit_logs (
          user_id, action, target_table, new_data, created_at
        ) VALUES (
          $1, 'create', 'items',
          $2, $3
        )
      `, [
        adminUser.id,
        JSON.stringify({ note: `${MOCK_TAG} Seeded records for fiscal year ${config.fy}` }),
        dateStr
      ])
    }

    // Restore replication role
    await client.query("SET session_replication_role = 'origin'")

    console.log('\n================ MULTI-YEAR SEED SUMMARY (2565 - 2575) ================')
    console.table(Object.entries(stats).map(([fy, data]) => ({
      'ปีงบประมาณ (พ.ศ.)': fy,
      'ครุภัณฑ์ (Assets)': data.assets,
      'วัสดุ (Materials)': data.materials,
      'การเบิก-จ่าย (Disbursements)': data.disbursements,
      'มูลค่าโดยประมาณ (THB)': data.totalValue.toLocaleString('th-TH')
    })))
    console.log('Seeding completed successfully!')

  } catch (error) {
    console.error('Seeding error:', error)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

seedMultiYear().catch(err => {
  console.error(err)
  process.exitCode = 1
})
