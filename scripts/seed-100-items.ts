/**
 * scripts/seed-100-items.ts
 * Inserts 100 randomised asset / material items into the CAMMS registry.
 * Run: npx tsx scripts/seed-100-items.ts
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
  computer:  '117bf681-60d8-42de-bd81-44bac3909ce0',  // ครุภัณฑ์คอมพิวเตอร์
  office:    '5c21aeac-d8a6-4b9b-80b2-0093f19fd35c',  // ครุภัณฑ์สำนักงาน (furniture + supplies)
  electric:  '550cb0a5-0c8c-4bcc-8176-7d09326aeae8',  // ครุภัณฑ์ไฟฟ้าและวิทยุ (appliances)
  media:     'e9950add-d3ce-4f16-80e1-7d13c40531af',  // ครุภัณฑ์โฆษณาและเผยแพร่
}
const LOC = {
  cdo: '7eea3e08-7f56-4bff-a835-f68afb4d943b',  // ห้อง CDO
  coo: 'd9808294-95a7-40e1-add2-c77dc4490154',  // ห้อง COO
}
const UNIT = {
  box:     '16f10405-0850-41d3-8a90-a90230f209e9',  // กล่อง
  piece:   '676bf1e4-40e3-40ba-ad39-948a362f1569',  // ชิ้น
  machine: 'bac631e6-3b71-4679-b5ed-50bf6a780cef',  // เครื่อง
  count:   'ec3dcc95-66a8-4e16-addf-39472841ff2e',  // จำนวน
}

const STATUSES = ['active', 'active', 'active', 'spare', 'damaged', 'waiting_repair', 'inactive'] as const
const PERSONS  = [
  'สมชาย วงศ์สุวรรณ', 'นภาพร เจริญทรัพย์', 'วิชัย รักดี',
  'สุภาพร มีสุข', 'อนันต์ ศรีวิไล', 'ปิยะ ธรรมรักษ์', 'มาลี ประสงค์ดี',
  'กิตติ สุขสมบัติ', 'ชัยวัฒน์ พรหมมาศ', 'ลลิตา บุญเลิศ',
]

// ── Unsplash photos by category ───────────────────────────────────────────────
const PHOTOS: Record<string, string[]> = {
  computer: [
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&q=80',
    'https://images.unsplash.com/photo-1611078489935-0cb964de46d6?w=600&q=80',
    'https://images.unsplash.com/photo-1593640408182-31c228f29bf3?w=600&q=80',
    'https://images.unsplash.com/photo-1587614382346-4ec70e388b28?w=600&q=80',
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&q=80',
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&q=80',
    'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600&q=80',
    'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80',
  ],
  furniture: [
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
    'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=600&q=80',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=600&q=80',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&q=80',
    'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600&q=80',
    'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=600&q=80',
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&q=80',
  ],
  appliance: [
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80',
    'https://images.unsplash.com/photo-1509130872995-86c1159b5f24?w=600&q=80',
    'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=600&q=80',
    'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?w=600&q=80',
    'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?w=600&q=80',
    'https://images.unsplash.com/photo-1593359677879-a4bb92f4834a?w=600&q=80',
    'https://images.unsplash.com/photo-1560707854-fb9a44e5b885?w=600&q=80',
  ],
  supplies: [
    'https://images.unsplash.com/photo-1542621334-a254cf47733d?w=600&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    'https://images.unsplash.com/photo-1585952059706-8e97b6c37c59?w=600&q=80',
    'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=600&q=80',
    'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=600&q=80',
    'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&q=80',
    'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=600&q=80',
  ],
}

interface ItemDef {
  item_name: string
  item_type: 'asset' | 'material'
  category_id: string
  unit_id: string
  brand?: string
  model?: string
  photoKey: keyof typeof PHOTOS
}

// ── 100 item definitions (20 computer assets, 20 office/furniture assets,
//    20 electrical assets, 40 office material supplies) ─────────────────────────
const ITEM_DEFS: ItemDef[] = [
  // ── Computer / IT — assets (20)
  { item_name: 'โน้ตบุ๊ก',               item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'Dell',          model: 'Latitude 5540',            photoKey: 'computer' },
  { item_name: 'โน้ตบุ๊ก',               item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'HP',            model: 'EliteBook 845 G10',        photoKey: 'computer' },
  { item_name: 'โน้ตบุ๊ก',               item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'Lenovo',        model: 'ThinkPad X1 Carbon Gen11', photoKey: 'computer' },
  { item_name: 'จอมอนิเตอร์',            item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'LG',            model: '27UK850-W 4K',             photoKey: 'computer' },
  { item_name: 'จอมอนิเตอร์',            item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'Samsung',       model: 'S27A700NWE',               photoKey: 'computer' },
  { item_name: 'จอมอนิเตอร์',            item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'BenQ',          model: 'GW2780E 27',               photoKey: 'computer' },
  { item_name: 'คีย์บอร์ดไร้สาย',       item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'Logitech',      model: 'MX Keys S',               photoKey: 'computer' },
  { item_name: 'เมาส์ไร้สาย',            item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'Logitech',      model: 'MX Master 3S',             photoKey: 'computer' },
  { item_name: 'เครื่องพิมพ์เลเซอร์',   item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.machine, brand: 'HP',            model: 'LaserJet Pro M404dn',      photoKey: 'computer' },
  { item_name: 'เครื่องพิมพ์เลเซอร์',   item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.machine, brand: 'Brother',       model: 'HL-L5100DN',               photoKey: 'computer' },
  { item_name: 'เครื่องสแกนเอกสาร',     item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.machine, brand: 'Fujitsu',       model: 'ScanSnap iX1600',          photoKey: 'computer' },
  { item_name: 'คอมพิวเตอร์ตั้งโต๊ะ',  item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.machine, brand: 'Lenovo',        model: 'ThinkCentre M70q Gen3',    photoKey: 'computer' },
  { item_name: 'แท็บเล็ต',              item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'Apple',         model: 'iPad Pro M4 11',           photoKey: 'computer' },
  { item_name: 'เว็บแคม',               item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'Logitech',      model: 'C925e 1080p',              photoKey: 'computer' },
  { item_name: 'ลำโพงประชุม',           item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'Jabra',         model: 'Speak2 75',                photoKey: 'computer' },
  { item_name: 'ฮับ USB-C 7-in-1',      item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'Anker',         model: 'PowerExpand+ 7-in-1',      photoKey: 'computer' },
  { item_name: 'ที่วางโน้ตบุ๊ก',       item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'Rain Design',   model: 'mRise Stand',              photoKey: 'computer' },
  { item_name: 'เราเตอร์ WiFi 6',       item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'ASUS',          model: 'RT-AX88U Pro',             photoKey: 'computer' },
  { item_name: 'Network Switch',         item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'Cisco',         model: 'SG350-10 10-Port',         photoKey: 'computer' },
  { item_name: 'รางปลั๊กไฟ 5 ช่อง',    item_type: 'asset',    category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'Toshino',       model: '5-Outlet 5m Surge',        photoKey: 'computer' },

  // ── Office Furniture — assets (20)
  { item_name: 'เก้าอี้สำนักงาน',       item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Herman Miller', model: 'Aeron Chair Sz B',         photoKey: 'furniture' },
  { item_name: 'เก้าอี้สำนักงาน',       item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Steelcase',    model: 'Leap V2',                  photoKey: 'furniture' },
  { item_name: 'เก้าอี้สำนักงาน',       item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Ergotune',     model: 'Supreme Pro S9',           photoKey: 'furniture' },
  { item_name: 'โต๊ะทำงาน',             item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'IKEA',          model: 'Bekant 160x80',            photoKey: 'furniture' },
  { item_name: 'โต๊ะทำงาน',             item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Index Living',  model: 'Primo Desk 160',           photoKey: 'furniture' },
  { item_name: 'โต๊ะปรับระดับ',         item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Flexispot',    model: 'E7 Pro 180x80',            photoKey: 'furniture' },
  { item_name: 'ชั้นวางเอกสาร',         item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'IKEA',          model: 'Kallax 4x4',               photoKey: 'furniture' },
  { item_name: 'ตู้เก็บเอกสาร',         item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Index Living',  model: 'Steel Cabinet 4D',         photoKey: 'furniture' },
  { item_name: 'ตู้ล็อกเกอร์',           item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Shuter',        model: '6-Door Locker',            photoKey: 'furniture' },
  { item_name: 'โซฟาต้อนรับ',           item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.count,   brand: 'SB Design',    model: '3+1 Seater Set',           photoKey: 'furniture' },
  { item_name: 'โต๊ะประชุม',            item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Index Living',  model: 'Largo Conference 240',     photoKey: 'furniture' },
  { item_name: 'โต๊ะกลม',               item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'IKEA',          model: 'Ingatorp D110',            photoKey: 'furniture' },
  { item_name: 'ตู้เซฟ',               item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Yale',          model: 'YSV/250/DB2',              photoKey: 'furniture' },
  { item_name: 'ไวท์บอร์ด',             item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Bi-Office',    model: 'MA2700170 180x90',         photoKey: 'furniture' },
  { item_name: 'กระดานแม่เหล็ก',        item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'U Brands',     model: 'Magnetic Dry-Erase 36',    photoKey: 'furniture' },
  { item_name: 'ชั้นวางของ Heavy Duty',  item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Boltons',      model: 'Steel Rack 5-Tier',        photoKey: 'furniture' },
  { item_name: 'ฉากกั้นโต๊ะ',          item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'IKEA',          model: 'Eilif Screen 160x68',      photoKey: 'furniture' },
  { item_name: 'เก้าอี้รับแขก',         item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'SB Design',    model: 'Visitor Chair V1',         photoKey: 'furniture' },
  { item_name: 'โต๊ะรับแขก',            item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'IKEA',          model: 'Hemnes Coffee Table',      photoKey: 'furniture' },
  { item_name: 'ม่านห้องทำงาน',         item_type: 'asset',    category_id: CAT.office,    unit_id: UNIT.count,   brand: 'Lorrene',      model: 'Blackout Curtain 200x260', photoKey: 'furniture' },

  // ── Electrical Appliances — assets (20)
  { item_name: 'เครื่องปรับอากาศ',      item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.machine, brand: 'Daikin',        model: 'FTKM35QV2S 12000 BTU',     photoKey: 'appliance' },
  { item_name: 'เครื่องปรับอากาศ',      item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.machine, brand: 'Mitsubishi',   model: 'MSZ-GE25VA 9000 BTU',      photoKey: 'appliance' },
  { item_name: 'เครื่องกรองอากาศ',      item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.machine, brand: 'Xiaomi',        model: 'Smart Air Purifier 4 Pro', photoKey: 'appliance' },
  { item_name: 'พัดลมตั้งพื้น',         item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.piece,   brand: 'Panasonic',    model: 'F-MX407 16',               photoKey: 'appliance' },
  { item_name: 'กาต้มน้ำไฟฟ้า',         item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.machine, brand: 'Philips',      model: 'HD9350/90 1.7L',           photoKey: 'appliance' },
  { item_name: 'เครื่องทำกาแฟ',         item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.machine, brand: 'Nespresso',    model: 'Vertuo Next',              photoKey: 'appliance' },
  { item_name: 'ไมโครเวฟ',              item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.machine, brand: 'Sharp',        model: 'R-200W 20L',               photoKey: 'appliance' },
  { item_name: 'ตู้เย็น',              item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.piece,   brand: 'Hitachi',      model: 'R-B300P7',                 photoKey: 'appliance' },
  { item_name: 'โทรทัศน์',             item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.piece,   brand: 'Samsung',      model: 'QN55S90CAFXZT 55',         photoKey: 'appliance' },
  { item_name: 'โทรทัศน์',             item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.piece,   brand: 'LG',            model: 'OLED C3 65',               photoKey: 'appliance' },
  { item_name: 'เครื่องฉายโปรเจกเตอร์', item_type: 'asset',  category_id: CAT.electric,  unit_id: UNIT.machine, brand: 'Epson',        model: 'EB-FH52 3500 lm',          photoKey: 'appliance' },
  { item_name: 'UPS เครื่องสำรองไฟ',   item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.piece,   brand: 'APC',          model: 'Back-UPS Pro 1200VA',      photoKey: 'appliance' },
  { item_name: 'โทรศัพท์สำนักงาน',     item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.piece,   brand: 'Panasonic',    model: 'KX-TGE110',                photoKey: 'appliance' },
  { item_name: 'ตู้น้ำดื่ม',           item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.machine, brand: 'Coway',        model: 'CHP-06AL',                 photoKey: 'appliance' },
  { item_name: 'เครื่องสำรองน้ำดื่ม',  item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.machine, brand: 'Panasonic',    model: 'SDU-C3520',                photoKey: 'appliance' },
  { item_name: 'กล้องวงจรปิด IP',       item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.piece,   brand: 'Hikvision',   model: 'DS-2CD2143G2-I 4MP',       photoKey: 'appliance' },
  { item_name: 'เครื่องอ่านบัตร NFC',   item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.piece,   brand: 'HID',          model: 'OMNIKEY 5022',             photoKey: 'appliance' },
  { item_name: 'จอ Interactive LED 65',  item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.piece,   brand: 'ViewSonic',    model: 'IFP6550 65 4K',            photoKey: 'appliance' },
  { item_name: 'เครื่องถ่ายเอกสาร',    item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.machine, brand: 'Ricoh',        model: 'IM 350F A4',               photoKey: 'appliance' },
  { item_name: 'เครื่องเจาะกระดาษ',    item_type: 'asset',    category_id: CAT.electric,  unit_id: UNIT.piece,   brand: 'Carl',         model: 'EP-32N 32-Sheet',          photoKey: 'appliance' },

  // ── Office Supplies — materials (40)
  { item_name: 'กระดาษ A4 80g',          item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Double A',     model: '500 sheets/ream',          photoKey: 'supplies' },
  { item_name: 'กระดาษ A4 80g',          item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'IK Yellow',    model: '500 sheets/ream',          photoKey: 'supplies' },
  { item_name: 'กระดาษ A3 80g',          item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Double A',     model: '500 sheets/ream',          photoKey: 'supplies' },
  { item_name: 'ปากกาลูกลื่น น้ำเงิน',  item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Pilot',        model: 'G-2 0.5mm Blue 12pcs',    photoKey: 'supplies' },
  { item_name: 'ปากกาลูกลื่น ดำ',        item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Pilot',        model: 'G-2 0.5mm Black 12pcs',   photoKey: 'supplies' },
  { item_name: 'ปากกาไวท์บอร์ด 4 สี',   item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Pilot',        model: 'WBMA-M 4-colour set',     photoKey: 'supplies' },
  { item_name: 'ปากกาไวท์บอร์ด ชุด',    item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Pentel',       model: 'MW455 4-colour set',       photoKey: 'supplies' },
  { item_name: 'ดินสอกด 0.5mm',          item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Pentel',       model: 'Graph 1000 For Pro',       photoKey: 'supplies' },
  { item_name: 'แฟ้มเอกสาร A4 สีน้ำเงิน', item_type: 'material', category_id: CAT.office,  unit_id: UNIT.piece,   brand: 'King Jim',    model: 'PP Folder A4 Blue',        photoKey: 'supplies' },
  { item_name: 'แฟ้มเอกสาร A4 สีแดง',   item_type: 'material', category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'King Jim',     model: 'PP Folder A4 Red',         photoKey: 'supplies' },
  { item_name: 'โพสต์อิท 76x76mm',       item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: '3M Post-it',   model: '100 sheets/pad',           photoKey: 'supplies' },
  { item_name: 'โพสต์อิท Assorted',      item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: '3M Post-it',   model: 'Canary Yellow 654-10PK',   photoKey: 'supplies' },
  { item_name: 'ลวดเย็บกระดาษ 26/6',    item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Max',          model: 'HD-50 5000pcs',            photoKey: 'supplies' },
  { item_name: 'เครื่องเย็บกระดาษ',     item_type: 'material', category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Max',          model: 'HD-50',                    photoKey: 'supplies' },
  { item_name: 'กรรไกรสำนักงาน',         item_type: 'material', category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Pentel',       model: 'PHC-6 22cm',               photoKey: 'supplies' },
  { item_name: 'เทปใส 18mm',             item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: '3M Scotch',    model: '600 18mm 33m 10rolls',     photoKey: 'supplies' },
  { item_name: 'เทปโฟม 2 หน้า',          item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: '3M',           model: 'Foam Tape 1 inch 5Y',      photoKey: 'supplies' },
  { item_name: 'กระดาษโน้ต A5',          item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Campap',       model: '100 sheets',               photoKey: 'supplies' },
  { item_name: 'หมึกพิมพ์เลเซอร์ HP',   item_type: 'material', category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'HP',           model: 'CF217A Toner',             photoKey: 'computer' },
  { item_name: 'หมึกพิมพ์เลเซอร์ Brother', item_type: 'material', category_id: CAT.computer, unit_id: UNIT.piece,  brand: 'Brother',    model: 'TN-2480 Toner',            photoKey: 'computer' },
  { item_name: 'ไส้ดินสอกด 0.5mm',      item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Pentel',       model: 'C505-HB 40pcs',            photoKey: 'supplies' },
  { item_name: 'แบตเตอรี่ AA',           item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Energizer',   model: 'Max AA 8pcs',              photoKey: 'supplies' },
  { item_name: 'แบตเตอรี่ AAA',          item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Energizer',   model: 'Max AAA 8pcs',             photoKey: 'supplies' },
  { item_name: 'ปากกาเน้นข้อความ',      item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Stabilo',     model: 'Boss 70 5-colour set',     photoKey: 'supplies' },
  { item_name: 'กล่องเก็บเอกสาร A4',    item_type: 'material', category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'PLUS',         model: 'File Box A4',              photoKey: 'supplies' },
  { item_name: 'ถุงขยะสำนักงาน 30L',    item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Glad',        model: '30L 50pcs/pack',           photoKey: 'supplies' },
  { item_name: 'สบู่ล้างมือ',            item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Dettol',      model: 'Pump 500ml',               photoKey: 'supplies' },
  { item_name: 'กระดาษเช็ดมือ',          item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Scott',       model: 'Select 250sh 12rolls',     photoKey: 'supplies' },
  { item_name: 'แอลกอฮอล์เจล 450ml',    item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Dettol',      model: 'Hand Sanitizer 450ml',     photoKey: 'supplies' },
  { item_name: 'น้ำยาทำความสะอาด',       item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Flash',       model: 'Multi-surface 1L',         photoKey: 'supplies' },
  { item_name: 'ซองจดหมาย A4',           item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Green',       model: 'A4 50pcs',                 photoKey: 'supplies' },
  { item_name: 'ซองน้ำตาล A5',           item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Green',       model: 'A5 50pcs',                 photoKey: 'supplies' },
  { item_name: 'ยางรัดของ',             item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Plus',        model: 'Rubber Band 50g',           photoKey: 'supplies' },
  { item_name: 'หนีบกระดาษ 32mm',        item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Carl',        model: 'Binder Clip 32mm 12pcs',   photoKey: 'supplies' },
  { item_name: 'คลิปหนีบกระดาษ',        item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Max',         model: 'Paper Clip 50pcs',         photoKey: 'supplies' },
  { item_name: 'ไม้บรรทัดโลหะ 30cm',    item_type: 'material', category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Pentel',      model: 'Steel Rule 30cm',           photoKey: 'supplies' },
  { item_name: 'ยางลบ',                  item_type: 'material', category_id: CAT.office,    unit_id: UNIT.box,     brand: 'Staedtler',   model: 'Mars Plastic 526 50 10pcs', photoKey: 'supplies' },
  { item_name: 'แผ่น CD-R 700MB',        item_type: 'material', category_id: CAT.computer,  unit_id: UNIT.box,     brand: 'Verbatim',    model: '52x 100pcs',               photoKey: 'computer' },
  { item_name: 'Flash Drive 32GB',        item_type: 'material', category_id: CAT.computer,  unit_id: UNIT.piece,   brand: 'SanDisk',     model: 'Cruzer Blade USB3 32GB',   photoKey: 'computer' },
  { item_name: 'หมึกสแตมป์',            item_type: 'material', category_id: CAT.office,    unit_id: UNIT.piece,   brand: 'Shiny',       model: 'SH-500 Red Ink',           photoKey: 'supplies' },
]

// ── helpers ───────────────────────────────────────────────────────────────────
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function padNum(n: number, digits = 4) { return String(n).padStart(digits, '0') }
function photoUrl(key: keyof typeof PHOTOS) { return pick(PHOTOS[key]) }

const LOCATION_IDS = Object.values(LOC)

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const now = new Date()
  let assetCounter = 1

  const rows = ITEM_DEFS.map((def) => {
    const status = pick(STATUSES)
    const isAsset = def.item_type === 'asset'
    const qty = isAsset ? 1 : Math.floor(Math.random() * 50) + 1
    const n = isAsset ? assetCounter++ : 0

    return {
      item_name:          def.item_name,
      item_type:          def.item_type,
      category_id:        def.category_id,
      unit_id:            def.unit_id,
      brand:              def.brand ?? null,
      model:              def.model ?? null,
      quantity:           qty,
      unit_price:         isAsset
                            ? Math.round((Math.random() * 49000 + 1000) / 100) * 100
                            : Math.round((Math.random() * 900 + 50) / 10) * 10,
      asset_no:           isAsset ? `AST-${now.getFullYear()}-${padNum(n)}` : null,
      serial_no:          isAsset ? `SN${padNum(Math.floor(Math.random() * 999999), 6)}` : null,
      location_id:        pick(LOCATION_IDS),
      responsible_person: pick(PERSONS),
      status,
      note:               status === 'damaged'
                            ? 'ชำรุดรอซ่อม'
                            : status === 'waiting_repair'
                              ? 'ส่งซ่อมแล้ว รอรับคืน'
                              : null,
      image_url:          photoUrl(def.photoKey),
      created_at:         new Date(now.getTime() - Math.random() * 730 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at:         now.toISOString(),
    }
  })

  console.log(`Inserting ${rows.length} items…`)

  // Insert in batches of 25 to stay within Supabase request limits
  const BATCH_SIZE = 25
  let totalInserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const { data, error } = await supabase.from('items').insert(batch).select('id, item_name, item_type')
    if (error) {
      console.error(`\n❌ Batch ${batchNum} failed:`, error.message)
      process.exit(1)
    }
    totalInserted += data?.length ?? 0
    console.log(`  ✓ Batch ${batchNum}/4: inserted ${data?.length ?? 0} items`)
  }

  console.log(`\n✅ Done — inserted ${totalInserted} items total.`)

  // Bust Next.js layout cache so sidebar counts update immediately
  await revalidateNextjsCache()
}

/**
 * Calls the /api/revalidate endpoint on the local dev server so the Next.js
 * sidebar cache is busted after a direct Supabase insert.
 * Requires REVALIDATE_SECRET in .env.local and the dev server to be running.
 */
async function revalidateNextjsCache() {
  const secret = process.env.REVALIDATE_SECRET
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  if (!secret) {
    console.log('  ℹ️  REVALIDATE_SECRET not set — skipping sidebar cache bust.')
    console.log('     Reload the browser page to see updated counts.')
    return
  }
  try {
    const res = await fetch(`${appUrl}/api/revalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    if (res.ok) {
      console.log('  ✓ Next.js sidebar cache busted successfully.')
    } else {
      console.log(`  ⚠️  Revalidate returned ${res.status} — reload the browser manually.`)
    }
  } catch {
    console.log('  ⚠️  Could not reach Next.js dev server — reload the browser manually.')
  }
}

main().catch(e => { console.error(e); process.exit(1) })
