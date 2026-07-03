/**
 * scripts/seed-50-items.ts
 * Inserts 50 randomised asset / material items into the CAMMS registry.
 * Run: npx tsx scripts/seed-50-items.ts
 */
import path from 'path'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

// ── load .env.local ──────────────────────────────────────────────────────────
const envPath = path.resolve('.env.local')
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const idx = trimmed.indexOf('=')
    if (idx < 0) return
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
    if (key && !process.env[key]) process.env[key] = val
  })
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ── real IDs from the database ───────────────────────────────────────────────
const CAT = {
  computer:  '27577310-2bc2-45d8-954f-37a1ee014f56',
  furniture: 'e20cca06-a30e-434f-94b7-6a104dd10b62',
  appliance: '438aa651-e504-4299-bda0-a6b853052f0c',
  supplies:  'e3b1c460-b202-415e-b0d5-b46d4b82cab5',
}
const LOC = {
  coo:     '021f89b3-57eb-4268-8662-ece83962c63f',
  it_room: '686cab92-b092-4794-8875-c3300b0ede9a',
  storage: 'dad1cfdc-be66-45bc-abf6-8e226ec5329a',
}
const UNIT = {
  box:   '676bf1e4-40e3-40ba-ad39-948a362f1569',
  piece: '16f10405-0850-41d3-8a90-a90230f209e9',
  set:   'a1c36b77-ef8f-4b93-9ad5-1beb932429cb',
}

const STATUSES = ['active', 'active', 'active', 'spare', 'damaged', 'waiting_repair', 'inactive'] as const
const PERSONS  = ['สมชาย วงศ์สุวรรณ', 'นภาพร เจริญทรัพย์', 'วิชัย รักดี', 'สุภาพร มีสุข', 'อนันต์ ศรีวิไล', 'ปิยะ ธรรมรักษ์', 'มาลี ประสงค์ดี']

// ── realistic Unsplash photos (600×400, no auth needed) ───────────────────────
// Using direct source.unsplash.com URLs by topic keyword
const PHOTOS: Record<string, string[]> = {
  computer: [
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&q=80',  // laptop open
    'https://images.unsplash.com/photo-1611078489935-0cb964de46d6?w=600&q=80',  // monitor setup
    'https://images.unsplash.com/photo-1593640408182-31c228f29bf3?w=600&q=80',  // desktop PC
    'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=600&q=80',  // keyboard mouse
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&q=80',  // printer
  ],
  furniture: [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',  // office sofa
    'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&q=80', // desk chair
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&q=80', // office desk
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&q=80', // conference table
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&q=80', // bookshelf
  ],
  appliance: [
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80', // air purifier
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80', // air conditioner
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80', // microwave
    'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=600&q=80', // coffee maker
    'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=600&q=80', // scanner
  ],
  supplies: [
    'https://images.unsplash.com/photo-1542621334-a254cf47733d?w=600&q=80', // pens & pencils
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80', // sticky notes
    'https://images.unsplash.com/photo-1585952059706-8e97b6c37c59?w=600&q=80', // notebooks
    'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80', // stapler
    'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=600&q=80', // paper reams
  ],
}

// ── item definitions ──────────────────────────────────────────────────────────
interface ItemDef {
  item_name: string
  item_type: 'asset' | 'material'
  category_id: string
  unit_id: string
  brand?: string
  model?: string
  photoKey: keyof typeof PHOTOS
}

const ITEM_DEFS: ItemDef[] = [
  // Computer / asset
  { item_name: 'โน้ตบุ๊ก',              item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece, brand: 'Dell',        model: 'Latitude 5430',        photoKey: 'computer' },
  { item_name: 'โน้ตบุ๊ก',              item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece, brand: 'HP',          model: 'EliteBook 840 G9',     photoKey: 'computer' },
  { item_name: 'จอมอนิเตอร์',           item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece, brand: 'LG',          model: '27UK850-W',            photoKey: 'computer' },
  { item_name: 'จอมอนิเตอร์',           item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece, brand: 'Samsung',     model: 'S27A700NWE',           photoKey: 'computer' },
  { item_name: 'คีย์บอร์ดไร้สาย',      item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece, brand: 'Logitech',    model: 'MX Keys',              photoKey: 'computer' },
  { item_name: 'เมาส์ไร้สาย',           item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece, brand: 'Logitech',    model: 'MX Master 3',          photoKey: 'computer' },
  { item_name: 'เครื่องพิมพ์เลเซอร์',  item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece, brand: 'HP',          model: 'LaserJet Pro M404dn',  photoKey: 'computer' },
  { item_name: 'เครื่องสแกนเอกสาร',    item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece, brand: 'Fujitsu',     model: 'ScanSnap iX1500',      photoKey: 'computer' },
  { item_name: 'คอมพิวเตอร์ตั้งโต๊ะ', item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.set,   brand: 'Lenovo',      model: 'ThinkCentre M70q',     photoKey: 'computer' },
  { item_name: 'แท็บเล็ต',             item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece, brand: 'Apple',       model: 'iPad Air M2',          photoKey: 'computer' },
  // Furniture / asset
  { item_name: 'เก้าอี้สำนักงาน',      item_type: 'asset',    category_id: CAT.furniture, unit_id: UNIT.piece, brand: 'Herman Miller', model: 'Aeron Chair',          photoKey: 'furniture' },
  { item_name: 'เก้าอี้สำนักงาน',      item_type: 'asset',    category_id: CAT.furniture, unit_id: UNIT.piece, brand: 'Steelcase',  model: 'Leap V2',              photoKey: 'furniture' },
  { item_name: 'โต๊ะทำงาน',            item_type: 'asset',    category_id: CAT.furniture, unit_id: UNIT.piece, brand: 'IKEA',        model: 'Bekant 160×80',        photoKey: 'furniture' },
  { item_name: 'โต๊ะทำงาน',            item_type: 'asset',    category_id: CAT.furniture, unit_id: UNIT.piece, brand: 'Index Living', model: 'Primo Desk 160',      photoKey: 'furniture' },
  { item_name: 'ชั้นวางเอกสาร',        item_type: 'asset',    category_id: CAT.furniture, unit_id: UNIT.piece, brand: 'IKEA',        model: 'Kallax 4×4',           photoKey: 'furniture' },
  { item_name: 'ตู้เก็บเอกสาร',        item_type: 'asset',    category_id: CAT.furniture, unit_id: UNIT.piece, brand: 'Index Living', model: 'Steel Cabinet 4D',    photoKey: 'furniture' },
  { item_name: 'โซฟาต้อนรับ',          item_type: 'asset',    category_id: CAT.furniture, unit_id: UNIT.set,   brand: 'SB Design',  model: '3+1 Seater Set',       photoKey: 'furniture' },
  { item_name: 'โต๊ะประชุม',           item_type: 'asset',    category_id: CAT.furniture, unit_id: UNIT.piece, brand: 'Index Living', model: 'Largo Conference 240', photoKey: 'furniture' },
  { item_name: 'ตู้เซฟ',              item_type: 'asset',    category_id: CAT.furniture, unit_id: UNIT.piece, brand: 'Yale',        model: 'YSV/250/DB2',          photoKey: 'furniture' },
  { item_name: 'ไวท์บอร์ด',            item_type: 'asset',    category_id: CAT.furniture, unit_id: UNIT.piece, brand: 'Bi-Office',   model: 'MA2700170 180×90',     photoKey: 'furniture' },
  // Appliances / asset
  { item_name: 'เครื่องปรับอากาศ',     item_type: 'asset',    category_id: CAT.appliance, unit_id: UNIT.piece, brand: 'Daikin',      model: 'FTKM35QV2S',           photoKey: 'appliance' },
  { item_name: 'เครื่องกรองอากาศ',     item_type: 'asset',    category_id: CAT.appliance, unit_id: UNIT.piece, brand: 'Xiaomi',      model: 'Air Purifier 4 Pro',   photoKey: 'appliance' },
  { item_name: 'กาต้มน้ำไฟฟ้า',        item_type: 'asset',    category_id: CAT.appliance, unit_id: UNIT.piece, brand: 'Philips',     model: 'HD9350/90',            photoKey: 'appliance' },
  { item_name: 'เครื่องทำกาแฟ',        item_type: 'asset',    category_id: CAT.appliance, unit_id: UNIT.piece, brand: 'Nespresso',   model: 'Vertuo Next',          photoKey: 'appliance' },
  { item_name: 'ไมโครเวฟ',             item_type: 'asset',    category_id: CAT.appliance, unit_id: UNIT.piece, brand: 'Sharp',       model: 'R-200(W)',             photoKey: 'appliance' },
  { item_name: 'ตู้เย็น',             item_type: 'asset',    category_id: CAT.appliance, unit_id: UNIT.piece, brand: 'Hitachi',     model: 'R-B300P7',             photoKey: 'appliance' },
  { item_name: 'โทรทัศน์',            item_type: 'asset',    category_id: CAT.appliance, unit_id: UNIT.piece, brand: 'Samsung',     model: 'QN65S90CAFXZT 65"',    photoKey: 'appliance' },
  { item_name: 'เครื่องฉายโปรเจกเตอร์', item_type: 'asset',  category_id: CAT.appliance, unit_id: UNIT.piece, brand: 'Epson',       model: 'EB-E20',               photoKey: 'appliance' },
  { item_name: 'UPS เครื่องสำรองไฟ',  item_type: 'asset',    category_id: CAT.appliance, unit_id: UNIT.piece, brand: 'APC',         model: 'Back-UPS 600VA',       photoKey: 'appliance' },
  { item_name: 'เราเตอร์ WiFi',        item_type: 'asset',    category_id: CAT.appliance, unit_id: UNIT.piece, brand: 'ASUS',        model: 'RT-AX88U',             photoKey: 'computer' },
  // Supplies / material
  { item_name: 'กระดาษ A4 80g',        item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.box,   brand: 'Double A',    model: '500 แผ่น/รีม',        photoKey: 'supplies' },
  { item_name: 'ปากกาลูกลื่น',         item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.box,   brand: 'Pilot',       model: 'G-2 0.5mm น้ำเงิน',   photoKey: 'supplies' },
  { item_name: 'ปากกาไวท์บอร์ด',       item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.box,   brand: 'Pilot',       model: 'WBMA-M 4 สี',          photoKey: 'supplies' },
  { item_name: 'ดินสอกด 0.5mm',        item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.box,   brand: 'Pentel',      model: 'Graph 1000 For Pro',   photoKey: 'supplies' },
  { item_name: 'แฟ้มเอกสาร A4',        item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.piece, brand: 'King Jim',    model: 'PP Folder A4',         photoKey: 'supplies' },
  { item_name: 'โพสต์อิท',            item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.box,   brand: '3M Post-it',  model: '76×76mm 100 แผ่น',    photoKey: 'supplies' },
  { item_name: 'ลวดเย็บกระดาษ 26/6',  item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.box,   brand: 'Max',         model: 'HD-50 5000 ตัว',       photoKey: 'supplies' },
  { item_name: 'เครื่องเย็บกระดาษ',   item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.piece, brand: 'Max',         model: 'HD-50',                photoKey: 'supplies' },
  { item_name: 'กรรไกรสำนักงาน',       item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.piece, brand: 'Pentel',      model: 'PHC-6',                photoKey: 'supplies' },
  { item_name: 'เทปใส 18mm',           item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.box,   brand: '3M Scotch',   model: '600 18mm×33m',         photoKey: 'supplies' },
  { item_name: 'กระดาษโน้ต A5',        item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.box,   brand: 'Campap',      model: '100 แผ่น',             photoKey: 'supplies' },
  { item_name: 'หมึกพิมพ์เลเซอร์',    item_type: 'material', category_id: CAT.computer,  unit_id: UNIT.piece, brand: 'HP',          model: 'CF217A Toner',         photoKey: 'computer' },
  { item_name: 'ไส้ดินสอกด 0.5mm',    item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.box,   brand: 'Pentel',      model: 'C505-HB 40 แท่ง',     photoKey: 'supplies' },
  { item_name: 'แผ่น CD-R 700MB',      item_type: 'material', category_id: CAT.computer,  unit_id: UNIT.box,   brand: 'Verbatim',    model: '52× 100 แผ่น',        photoKey: 'computer' },
  { item_name: 'แบตเตอรี่ AA',         item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.box,   brand: 'Energizer',   model: 'Max AA 8 ก้อน',       photoKey: 'supplies' },
  { item_name: 'ไม้บรรทัดโลหะ 30cm',  item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.piece, brand: 'Pentel',      model: 'Steel Rule 30cm',      photoKey: 'supplies' },
  { item_name: 'ปากกาเน้นข้อความ',    item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.box,   brand: 'Stabilo',     model: 'Boss 70 5 สี',         photoKey: 'supplies' },
  { item_name: 'กล่องเก็บเอกสาร',     item_type: 'material', category_id: CAT.supplies,  unit_id: UNIT.piece, brand: 'PLUS',        model: 'File Box A4',          photoKey: 'supplies' },
  { item_name: 'ที่วางโน้ตบุ๊ก',      item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece, brand: 'Rain Design',  model: 'mRise Stand',         photoKey: 'computer' },
  { item_name: 'ฮับ USB-C 7 in 1',    item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece, brand: 'Anker',       model: 'PowerExpand+ 7-in-1',  photoKey: 'computer' },
]

// ── helpers ───────────────────────────────────────────────────────────────────
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function padNum(n: number, digits = 4) { return String(n).padStart(digits, '0') }
function photoUrl(key: keyof typeof PHOTOS) { return pick(PHOTOS[key]) }

const LOCATION_IDS = Object.values(LOC)

// ── build rows ────────────────────────────────────────────────────────────────
async function main() {
  const now = new Date()
  const rows = ITEM_DEFS.map((def, i) => {
    const n = i + 1
    const status = pick(STATUSES)
    const qty = def.item_type === 'material' ? Math.floor(Math.random() * 50) + 1 : 1
    return {
      item_name:          def.item_name,
      item_type:          def.item_type,
      category_id:        def.category_id,
      unit_id:            def.unit_id,
      brand:              def.brand ?? null,
      model:              def.model ?? null,
      quantity:           qty,
      asset_no:           def.item_type === 'asset' ? `AST-${now.getFullYear()}-${padNum(n)}` : null,
      serial_no:          def.item_type === 'asset' ? `SN${padNum(Math.floor(Math.random() * 999999), 6)}` : null,
      location_id:        pick(LOCATION_IDS),
      responsible_person: pick(PERSONS),
      status,
      note:               status === 'damaged' ? 'ชำรุดรอซ่อม' : status === 'waiting_repair' ? 'ส่งซ่อมแล้ว รอรับคืน' : null,
      image_url:          photoUrl(def.photoKey),
      created_at:         new Date(now.getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at:         now.toISOString(),
    }
  })

  console.log(`Inserting ${rows.length} items…`)
  const { data, error } = await supabase.from('items').insert(rows).select('id, item_name')
  if (error) {
    console.error('❌ Insert failed:', error.message)
    process.exit(1)
  }
  console.log(`✅ Inserted ${data?.length ?? 0} items:`)
  data?.forEach(d => console.log(`  • [${d.id}] ${d.item_name}`))
}

main().catch(e => { console.error(e); process.exit(1) })
