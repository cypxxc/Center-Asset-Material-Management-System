import { parse } from 'dotenv'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import https from 'node:https'
import { Pool } from 'pg'
import { normalizeForStorage } from '../lib/unicode'

function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((res, rej) => {
    https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return fetchBuffer(response.headers.location).then(res).catch(rej)
      }
      const chunks: Buffer[] = []
      response.on('data', (c) => chunks.push(c))
      response.on('end', () => res(Buffer.concat(chunks)))
    }).on('error', rej)
  })
}

interface SeedItemDef {
  name: string
  type: 'material' | 'asset'
  categoryNameSnippet: string
  unitName: string
  locationName: string
  quantity: number
  unitPrice: number
  brand: string
  model: string
  responsiblePerson: string
  status: 'active' | 'spare' | 'damaged' | 'waiting_repair' | 'inactive' | 'disposed'
  note: string
  assetNo?: string
  serialNo?: string
  imageUrlSource: string
  depreciationEnabled?: boolean
  depreciationCost?: number
  depreciationUsefulLifeYears?: number
  depreciationStartBasis?: 'acquired' | 'available' | 'manual'
  depreciationStartDate?: string
}

const ITEMS_DATA: SeedItemDef[] = [
  // 10 Materials (วัสดุ)
  {
    name: 'กระดาษ Double A A4 80 แกรม',
    type: 'material',
    categoryNameSnippet: '7110', // ครุภัณฑ์สำนักงาน / วัสดุสำนักงาน
    unitName: 'รีม',
    locationName: 'ห้องเก็บพัสดุกลาง ชั้น 1',
    quantity: 50,
    unitPrice: 135,
    brand: 'Double A',
    model: 'A4 80gsm',
    responsiblePerson: 'สมชาย ใจดี',
    status: 'active',
    note: 'เบิกใช้สำหรับงานสารบรรณทั่วไป',
    imageUrlSource: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=500&q=80',
  },
  {
    name: 'ปากกาลูกลื่น Lancer Spiral 0.5 มม. น้ำเงิน',
    type: 'material',
    categoryNameSnippet: '7110',
    unitName: 'ด้าม',
    locationName: 'ห้องเก็บพัสดุกลาง ชั้น 1',
    quantity: 120,
    unitPrice: 8,
    brand: 'Lancer',
    model: 'Spiral 825',
    responsiblePerson: 'สมชาย ใจดี',
    status: 'active',
    note: 'หมึกน้ำเงิน กล่องละ 50 ด้าม',
    imageUrlSource: 'https://images.unsplash.com/photo-1585336261026-7f57636e0d86?w=500&q=80',
  },
  {
    name: 'ตลับหมึก HP LaserJet Black Toner 85A',
    type: 'material',
    categoryNameSnippet: '7440', // คอมพิวเตอร์
    unitName: 'กล่อง',
    locationName: 'ห้องเซิร์ฟเวอร์และไอที ชั้น 2',
    quantity: 10,
    unitPrice: 2450,
    brand: 'HP',
    model: 'CE285A',
    responsiblePerson: 'อนันต์ เทคโนโลยี',
    status: 'spare',
    note: 'สำรองสำหรับเครื่องพิมพ์ห้องการเงินและธุรการ',
    imageUrlSource: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=500&q=80',
  },
  {
    name: 'แฟ้มห่วง 2 นิ้ว ตราช้าง 2101F',
    type: 'material',
    categoryNameSnippet: '7110',
    unitName: 'เล่ม',
    locationName: 'ห้องธุรการกลาง อาคาร 1',
    quantity: 40,
    unitPrice: 85,
    brand: 'ตราช้าง',
    model: '2101F A4',
    responsiblePerson: 'วรรณา พัสดุ',
    status: 'active',
    note: 'ใช้จัดเก็บเอกสารสัญญาและโครงการ',
    imageUrlSource: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&q=80',
  },
  {
    name: 'ลวดเย็บกระดาษ MAX No.10',
    type: 'material',
    categoryNameSnippet: '7110',
    unitName: 'กล่อง',
    locationName: 'ห้องธุรการกลาง อาคาร 1',
    quantity: 80,
    unitPrice: 18,
    brand: 'MAX',
    model: 'No.10-1M',
    responsiblePerson: 'วรรณา พัสดุ',
    status: 'active',
    note: 'ขนาดมาตรฐานสำหรับเครื่องเย็บ No.10',
    imageUrlSource: 'https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=500&q=80',
  },
  {
    name: 'เทปใสแกน 1 นิ้ว 3M Scotch 3/4 นิ้ว',
    type: 'material',
    categoryNameSnippet: '7110',
    unitName: 'ม้วน',
    locationName: 'ห้องเก็บพัสดุกลาง ชั้น 1',
    quantity: 65,
    unitPrice: 25,
    brand: '3M',
    model: 'Scotch 500',
    responsiblePerson: 'สมชาย ใจดี',
    status: 'active',
    note: 'หน้ากว้าง 18 มม. ยาว 36 หลา',
    imageUrlSource: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=500&q=80',
  },
  {
    name: 'สายแลน UTP Cat6 Patch Cord 3 เมตร',
    type: 'material',
    categoryNameSnippet: '7440',
    unitName: 'เส้น',
    locationName: 'ห้องเซิร์ฟเวอร์และไอที ชั้น 2',
    quantity: 25,
    unitPrice: 120,
    brand: 'Link',
    model: 'US-5103-4',
    responsiblePerson: 'อนันต์ เทคโนโลยี',
    status: 'active',
    note: 'สายสำเร็จรูปจากโรงงาน สีฟ้า',
    imageUrlSource: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=500&q=80',
  },
  {
    name: 'น้ำยาทำความสะอาดพื้น Magiclean 5000 มล.',
    type: 'material',
    categoryNameSnippet: '7810', // งานบ้านงานครัว
    unitName: 'แกลลอน',
    locationName: 'ห้องแม่บ้าน ชั้น 1',
    quantity: 12,
    unitPrice: 280,
    brand: 'Magiclean',
    model: 'Berry Rose 5L',
    responsiblePerson: 'สมพร ขยันยิ่ง',
    status: 'active',
    note: 'สำหรับทำความสะอาดอาคารสำนักงานประจำสัปดาห์',
    imageUrlSource: 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=500&q=80',
  },
  {
    name: 'ถ่านอัลคาไลน์ Panasonic AA แพ็ค 4 ก้อน',
    type: 'material',
    categoryNameSnippet: '4120', // ไฟฟ้าและวิทยุ
    unitName: 'แพ็ค',
    locationName: 'ห้องเก็บพัสดุกลาง ชั้น 1',
    quantity: 35,
    unitPrice: 99,
    brand: 'Panasonic',
    model: 'EVOLTA AA LR6EG/4B',
    responsiblePerson: 'สมชาย ใจดี',
    status: 'active',
    note: 'สำหรับรีโมทเครื่องปรับอากาศและเมาส์ไร้สาย',
    imageUrlSource: 'https://images.unsplash.com/photo-1619725002198-6a689b72f41d?w=500&q=80',
  },
  {
    name: 'กระดาษโน้ตดัชนี Post-it 654 Neon',
    type: 'material',
    categoryNameSnippet: '7110',
    unitName: 'แพ็ค',
    locationName: 'ห้องธุรการกลาง อาคาร 1',
    quantity: 45,
    unitPrice: 42,
    brand: '3M Post-it',
    model: '654 Neon 3x3',
    responsiblePerson: 'วรรณา พัสดุ',
    status: 'active',
    note: 'คละ 5 สีสะท้อนแสง แพ็คละ 100 แผ่น',
    imageUrlSource: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=500&q=80',
  },

  // 10 Assets (ครุภัณฑ์)
  {
    name: 'โน้ตบุ๊ก Dell Latitude 5440 Core i7',
    type: 'asset',
    categoryNameSnippet: '7440', // คอมพิวเตอร์
    unitName: 'เครื่อง',
    locationName: 'กลุ่มงานสารสนเทศ ชั้น 2',
    quantity: 1,
    unitPrice: 42500,
    brand: 'Dell',
    model: 'Latitude 5440',
    responsiblePerson: 'วิชัย พัฒนาการ',
    status: 'active',
    note: 'เครื่องประจำตำแหน่งนักวิชาการคอมพิวเตอร์',
    assetNo: '7440-001-0001/67',
    serialNo: 'DELL-LAT-884912',
    imageUrlSource: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&q=80',
    depreciationEnabled: true,
    depreciationCost: 42500,
    depreciationUsefulLifeYears: 5,
    depreciationStartBasis: 'acquired',
    depreciationStartDate: '2024-01-15',
  },
  {
    name: 'เครื่องพิมพ์เลเซอร์มัลติฟังก์ชัน HP LaserJet Pro MFP M428fdw',
    type: 'asset',
    categoryNameSnippet: '7440',
    unitName: 'เครื่อง',
    locationName: 'ห้องธุรการกลาง อาคาร 1',
    quantity: 1,
    unitPrice: 21900,
    brand: 'HP',
    model: 'LaserJet Pro M428fdw',
    responsiblePerson: 'วรรณา พัสดุ',
    status: 'active',
    note: 'รองรับ Print/Scan/Copy/Fax ผ่านระบบเครือข่าย',
    assetNo: '7440-002-0005/67',
    serialNo: 'VND3C91823',
    imageUrlSource: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=500&q=80',
    depreciationEnabled: true,
    depreciationCost: 21900,
    depreciationUsefulLifeYears: 5,
    depreciationStartBasis: 'acquired',
    depreciationStartDate: '2024-02-01',
  },
  {
    name: 'เก้าอี้สำนักงานเพื่อสุขภาพ Ergonomic Herman Miller Aeron',
    type: 'asset',
    categoryNameSnippet: '7110', // สำนักงาน
    unitName: 'ตัว',
    locationName: 'ห้องผู้บริหาร ชั้น 3',
    quantity: 1,
    unitPrice: 58000,
    brand: 'Herman Miller',
    model: 'Aeron Size B',
    responsiblePerson: 'ดร.สมเกียรติ ยอดเยี่ยม',
    status: 'active',
    note: 'เก้าอี้ทำงานพนักพิงตาข่ายปรับระดับได้รอบทิศทาง',
    assetNo: '7110-005-0012/66',
    serialNo: 'HM-AER-99120',
    imageUrlSource: 'https://images.unsplash.com/photo-1580481077195-c3a821a58875?w=500&q=80',
    depreciationEnabled: true,
    depreciationCost: 58000,
    depreciationUsefulLifeYears: 10,
    depreciationStartBasis: 'acquired',
    depreciationStartDate: '2023-10-01',
  },
  {
    name: 'เครื่องฉายโปรเจกเตอร์ Epson EB-FH52 Full HD',
    type: 'asset',
    categoryNameSnippet: '7430', // โฆษณาและเผยแพร่
    unitName: 'เครื่อง',
    locationName: 'ห้องประชุมใหญ่ ชั้น 3',
    quantity: 1,
    unitPrice: 34900,
    brand: 'Epson',
    model: 'EB-FH52',
    responsiblePerson: 'อนันต์ เทคโนโลยี',
    status: 'active',
    note: 'ความสว่าง 4,000 Ansi Lumens ติดตั้งแขวนเพดาน',
    assetNo: '7430-001-0003/66',
    serialNo: 'EP-FH52-77123',
    imageUrlSource: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=500&q=80',
    depreciationEnabled: true,
    depreciationCost: 34900,
    depreciationUsefulLifeYears: 5,
    depreciationStartBasis: 'acquired',
    depreciationStartDate: '2023-11-15',
  },
  {
    name: 'กล้องบันทึกภาพดิจิทัล Sony Alpha 7 IV (Body)',
    type: 'asset',
    categoryNameSnippet: '7430',
    unitName: 'ตัว',
    locationName: 'กลุ่มงานสื่อสารองค์กรและประชาสัมพันธ์',
    quantity: 1,
    unitPrice: 82990,
    brand: 'Sony',
    model: 'ILCE-7M4',
    responsiblePerson: 'กิตติศักดิ์ ช่างภาพ',
    status: 'active',
    note: 'สำหรับงานถ่ายทอดสดและบันทึกภาพกิจกรรมทางการ',
    assetNo: '7430-002-0008/67',
    serialNo: 'SONY-A74-332190',
    imageUrlSource: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500&q=80',
    depreciationEnabled: true,
    depreciationCost: 82990,
    depreciationUsefulLifeYears: 5,
    depreciationStartBasis: 'acquired',
    depreciationStartDate: '2024-03-10',
  },
  {
    name: 'เครื่องปรับอากาศ Daikin Inverter 24,000 BTU',
    type: 'asset',
    categoryNameSnippet: '4120', // ไฟฟ้าและวิทยุ
    unitName: 'ชุด',
    locationName: 'ห้องประชุมย่อย 1 ชั้น 2',
    quantity: 1,
    unitPrice: 36500,
    brand: 'Daikin',
    model: 'FTKC28WV2S9',
    responsiblePerson: 'ประสิทธิ์ งานช่าง',
    status: 'active',
    note: 'บำรุงรักษาล้างแอร์ทุก 6 เดือน',
    assetNo: '4120-003-0015/65',
    serialNo: 'DK-INV-665510',
    imageUrlSource: 'https://images.unsplash.com/photo-1614633833026-0e9603d6d5eb?w=500&q=80',
    depreciationEnabled: true,
    depreciationCost: 36500,
    depreciationUsefulLifeYears: 8,
    depreciationStartBasis: 'acquired',
    depreciationStartDate: '2022-08-20',
  },
  {
    name: 'ตู้เย็น 2 ประตู Mitsubishi Electric 14.6 คิว',
    type: 'asset',
    categoryNameSnippet: '7810', // งานบ้านงานครัว
    unitName: 'เครื่อง',
    locationName: 'ห้องรับประทานอาหารส่วนกลาง ชั้น 1',
    quantity: 1,
    unitPrice: 16900,
    brand: 'Mitsubishi Electric',
    model: 'MR-FX41ES-BR',
    responsiblePerson: 'สมพร ขยันยิ่ง',
    status: 'active',
    note: 'ตู้เย็นสำหรับเจ้าหน้าที่และของว่างรับรอง',
    assetNo: '7810-001-0002/66',
    serialNo: 'MIT-REF-884210',
    imageUrlSource: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=500&q=80',
    depreciationEnabled: true,
    depreciationCost: 16900,
    depreciationUsefulLifeYears: 8,
    depreciationStartBasis: 'acquired',
    depreciationStartDate: '2023-05-12',
  },
  {
    name: 'โทรศัพท์ไอพี Cisco IP Phone 8845 Video',
    type: 'asset',
    categoryNameSnippet: '5805', // โทรคมนาคม
    unitName: 'เครื่อง',
    locationName: 'ห้องผู้บริหาร ชั้น 3',
    quantity: 1,
    unitPrice: 14500,
    brand: 'Cisco',
    model: 'CP-8845-K9',
    responsiblePerson: 'ดร.สมเกียรติ ยอดเยี่ยม',
    status: 'active',
    note: 'เชื่อมต่อ PBX กลางผ่านสายแลน PoE',
    assetNo: '5805-001-0004/66',
    serialNo: 'FCH2140V01A',
    imageUrlSource: 'https://images.unsplash.com/photo-1585336261026-7f57636e0d86?w=500&q=80',
    depreciationEnabled: true,
    depreciationCost: 14500,
    depreciationUsefulLifeYears: 5,
    depreciationStartBasis: 'acquired',
    depreciationStartDate: '2023-09-01',
  },
  {
    name: 'เครื่องวัดความดันโลหิต Omron HBP-1320 Professional',
    type: 'asset',
    categoryNameSnippet: '6515', // การแพทย์
    unitName: 'เครื่อง',
    locationName: 'ห้องปฐมพยาบาล อาคาร 1',
    quantity: 1,
    unitPrice: 8900,
    brand: 'Omron',
    model: 'HBP-1320',
    responsiblePerson: 'พว.สุดา พยาบาลวิชาชีพ',
    status: 'active',
    note: 'เครื่องตรวจสุขภาพเบื้องต้นสำหรับบุคลากร',
    assetNo: '6515-001-0001/67',
    serialNo: 'OMR-BP-44102',
    imageUrlSource: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=500&q=80',
    depreciationEnabled: true,
    depreciationCost: 8900,
    depreciationUsefulLifeYears: 5,
    depreciationStartBasis: 'acquired',
    depreciationStartDate: '2024-04-05',
  },
  {
    name: 'ลู่วิ่งไฟฟ้า Horizon Fitness Paragon X',
    type: 'asset',
    categoryNameSnippet: '7820', // กีฬา
    unitName: 'เครื่อง',
    locationName: 'ห้องออกกำลังกายสวัสดิการ ชั้น 4',
    quantity: 1,
    unitPrice: 65000,
    brand: 'Horizon Fitness',
    model: 'Paragon X',
    responsiblePerson: 'พิชัย สวัสดิการ',
    status: 'active',
    note: 'สำหรับส่งเสริมสุขภาพเจ้าหน้าที่',
    assetNo: '7820-001-0001/66',
    serialNo: 'HRZ-TM-90021',
    imageUrlSource: 'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=500&q=80',
    depreciationEnabled: true,
    depreciationCost: 65000,
    depreciationUsefulLifeYears: 7,
    depreciationStartBasis: 'acquired',
    depreciationStartDate: '2023-07-01',
  },
]

async function seed() {
  const config = parse(readFileSync('.env.postgres.app'))
  const storageRoot = resolve(config.LOCAL_STORAGE_PATH || './.local-storage')
  const pool = new Pool({ connectionString: config.DATABASE_MIGRATION_URL })
  const client = await pool.connect()

  try {
    const adminRes = await client.query("SELECT id FROM public.profiles WHERE role = 'admin' AND is_active = true LIMIT 1")
    if (!adminRes.rows.length) {
      throw new Error('Admin profile not found. Run npm run postgres:app:setup first.')
    }
    const adminId = adminRes.rows[0].id

    console.log(`Starting seed with Admin ID: ${adminId}`)

    // 1. Ensure units
    const unitsMap = new Map<string, string>()
    const unitNames = [...new Set(ITEMS_DATA.map((d) => d.unitName))]
    for (const u of unitNames) {
      const normalized = normalizeForStorage(u)
      const res = await client.query(
        `INSERT INTO public.units (name, is_active)
         VALUES ($1, true)
         ON CONFLICT (name) DO UPDATE SET is_active = true
         RETURNING id, name`,
        [normalized]
      )
      unitsMap.set(u, res.rows[0].id)
    }

    // 2. Ensure locations
    const locationsMap = new Map<string, string>()
    const locationNames = [...new Set(ITEMS_DATA.map((d) => d.locationName))]
    for (const loc of locationNames) {
      const normalized = normalizeForStorage(loc)
      let res = await client.query('SELECT id FROM public.locations WHERE name = $1 LIMIT 1', [normalized])
      if (!res.rows.length) {
        res = await client.query(
          `INSERT INTO public.locations (name, is_active)
           VALUES ($1, true)
           RETURNING id`,
          [normalized]
        )
      }
      locationsMap.set(loc, res.rows[0].id)
    }

    // 3. Fetch categories
    const catRes = await client.query('SELECT id, name, description FROM public.categories')
    const categories = catRes.rows

    console.log('Categories, units, and locations resolved.')

    // 4. Download images and insert items
    let insertedMaterials = 0
    let insertedAssets = 0

    for (const item of ITEMS_DATA) {
      // Find category
      const matchedCat = categories.find((c: { name: string; description: string | null }) =>
        c.name.includes(item.categoryNameSnippet) || (c.description && c.description.includes(item.categoryNameSnippet))
      )
      const categoryId = matchedCat ? matchedCat.id : categories[0]?.id
      const unitId = unitsMap.get(item.unitName)
      const locationId = locationsMap.get(item.locationName)

      // Download picture and store locally in compliance with CAMMS storage pattern
      const fileId = randomUUID()
      const extension = 'jpg'
      const relativeUrl = `/api/files/item-images/${adminId}/${fileId}.${extension}`
      const targetDiskPath = resolve(storageRoot, 'item-images', adminId, `${fileId}.${extension}`)

      mkdirSync(dirname(targetDiskPath), { recursive: true })

      let imageBytes: Buffer
      try {
        console.log(`Downloading image for: ${item.name}...`)
        imageBytes = await fetchBuffer(item.imageUrlSource)
        // Verify JPEG magic bytes; if not, wrap into fallback valid image
        if (!imageBytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) {
          console.warn(`Image for ${item.name} not JPEG, fallback applied`)
        }
      } catch (err) {
        console.warn(`Failed to fetch remote image for ${item.name}, using fallback:`, err)
        // 1x1 base64 transparent png or small dummy jpeg
        imageBytes = Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 1, 0, 72, 0, 72, 0, 0, 255, 219, 0, 67, 0, 8, 6, 6, 7, 6, 5, 8, 7, 7, 7, 9, 9, 8, 10, 12, 20, 13, 12, 11, 11, 12, 25, 18, 19, 15, 20, 29, 26, 31, 30, 29, 26, 28, 28, 32, 36, 46, 39, 32, 34, 44, 35, 28, 28, 40, 55, 41, 44, 48, 49, 52, 52, 52, 31, 39, 57, 61, 56, 50, 60, 46, 51, 52, 50, 255, 192, 0, 11, 8, 0, 1, 0, 1, 1, 1, 17, 0, 255, 218, 0, 8, 1, 1, 0, 0, 63, 0, 180, 0, 255, 217])
      }

      writeFileSync(targetDiskPath, imageBytes)

      // Insert item
      const insertSql = `
        INSERT INTO public.items (
          item_name, item_type, category_id, quantity, unit_price, unit_id,
          asset_no, serial_no, brand, model, location_id, responsible_person,
          status, note, image_url, created_by, updated_by,
          depreciation_enabled, depreciation_method, depreciation_cost,
          depreciation_useful_life_years, depreciation_start_basis,
          depreciation_start_date, depreciation_residual_value
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20,
          $21, $22,
          $23, $24
        ) RETURNING id
      `

      const values = [
        normalizeForStorage(item.name),
        item.type,
        categoryId,
        item.quantity,
        item.unitPrice,
        unitId,
        item.assetNo ? normalizeForStorage(item.assetNo) : null,
        item.serialNo ? normalizeForStorage(item.serialNo) : null,
        item.brand ? normalizeForStorage(item.brand) : null,
        item.model ? normalizeForStorage(item.model) : null,
        locationId,
        item.responsiblePerson ? normalizeForStorage(item.responsiblePerson) : null,
        item.status,
        item.note ? normalizeForStorage(item.note) : null,
        relativeUrl,
        adminId,
        adminId,
        item.depreciationEnabled ?? false,
        item.depreciationEnabled ? 'straight_line' : null,
        item.depreciationCost ?? null,
        item.depreciationUsefulLifeYears ?? null,
        item.depreciationStartBasis ?? null,
        item.depreciationStartDate ?? null,
        1,
      ]

      await client.query(insertSql, values)

      if (item.type === 'material') insertedMaterials++
      else insertedAssets++
    }

    console.log(`Successfully seeded ${insertedMaterials} materials and ${insertedAssets} assets with pictures!`)
  } catch (error) {
    console.error('Seeding failed:', error)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

seed().catch(console.error)
