import { InventoryItem, ActivityLog } from './types';

export const INITIAL_ITEMS: InventoryItem[] = [
  {
    id: 'item-1',
    name: 'Dell Latitude 5420',
    type: 'Asset',
    category: 'IT Equipment',
    qty: 1,
    location: 'Main Office',
    custodian: 'Somchai Jaidee',
    custodianInitial: 'S',
    status: 'ACTIVE',
    serialNumber: '5420-9912',
    lastAudited: '2023-10-15',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOYBXM4LXBGCq-VLlco7N4otdSI29bvFg19Towby6N7xkRAxCKfd8qZDadnbyqQl4YwpFQWskKnkayxTBsbtWCwBaRzbDu8AwWQ7zMIXKk2Rxb6jKQG9ce_pEm2PpuhwhqR959wlFse710AmvPV9NCTaWOEyeWlj04-_QfGsnmaQTFWyytS1LF1JCAubzh_KnY4GNIMHO8mmRRvrfFikm6mPX9HKc_KM0JBZleumZV_Wfsm6U_mIiDRg',
    description: 'โน๊ตบุ๊คสำหรับทำงานของแผนกพัฒนาซอฟต์แวร์ สเปก Core i5, RAM 16GB, SSD 512GB สภาพดี มีสติกเกอร์บริษัทติดอยู่ด้านหลังเครื่อง',
    notes: 'ใช้งานได้ปกติ แบตเตอรี่ยังเก็บไฟได้ดี'
  },
  {
    id: 'item-2',
    name: 'Ergonomic Chair',
    type: 'Supply',
    category: 'Furniture',
    qty: 5,
    location: 'Meeting Rm A',
    custodian: 'Somsak',
    custodianInitial: 'S',
    status: 'IN STOCK',
    serialNumber: 'CH-8812',
    lastAudited: '2023-10-14',
    image: 'https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=600&q=80',
    description: 'เก้าอี้สุขภาพสีดำ ปรับระดับได้พนักพิงรองรับสรีระ เบาะผ้าตาข่ายระบายอากาศได้ดี มีที่พักแขน',
    notes: 'เบาะเก้าอี้ตัวที่ 3 มีรอยเปื้อนเล็กน้อย ตัวอื่นๆ สภาพสมบูรณ์ดี'
  },
  {
    id: 'item-3',
    name: 'Epson Projector',
    type: 'Asset',
    category: 'AV',
    qty: 1,
    location: 'Storage B',
    custodian: 'Somchai',
    custodianInitial: 'S',
    status: 'DAMAGED',
    serialNumber: 'EP-4412',
    lastAudited: '2023-10-12',
    image: 'https://images.unsplash.com/photo-1535016120720-40c646be5580?auto=format&fit=crop&w=600&q=80',
    description: 'เครื่องฉายโปรเจคเตอร์สำหรับการประชุมทางไกล ความละเอียด Full HD มีพอร์ต HDMI และ VGA พร้อมรีโมทคอนโทรล',
    notes: 'หลอดภาพเสีย ไฟสถานะสีแดงกะพริบ รอส่งเคลมซ่อมบำรุง'
  },
  {
    id: 'item-4',
    name: 'HP LaserJet Pro',
    type: 'Asset',
    category: 'IT Equipment',
    qty: 2,
    location: 'Hallway',
    custodian: 'Admin',
    custodianInitial: 'A',
    status: 'ACTIVE',
    serialNumber: 'HP-1200',
    lastAudited: '2023-10-10',
    image: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=600&q=80',
    description: 'เครื่องพิมพ์เลเซอร์ขาวดำพิมพ์เร็ว เชื่อมต่อเครือข่ายไร้สาย Wi-Fi ได้ รองรับการพิมพ์สองหน้าอัตโนมัติ',
    notes: 'ตัวเครื่องที่ 1 ใช้งานที่โถงทางเดินชั้น 2 สภาพดี ตัวเครื่องที่ 2 อยู่ฝั่งสำนักงานหลัก'
  }
];

export const INITIAL_LOGS: ActivityLog[] = [
  {
    id: 'log-1',
    itemId: 'item-1',
    itemName: 'Dell Latitude 5420',
    action: 'ตรวจสอบสภาพครุภัณฑ์ (Audited)',
    details: 'ตรวจสภาพประจำปี: ทำงานได้ปกติ 100% สภาพตัวเครื่องสมบูรณ์',
    user: 'Somchai Jaidee',
    timestamp: '2023-10-15T10:00:00Z'
  },
  {
    id: 'log-2',
    itemId: 'item-2',
    itemName: 'Ergonomic Chair',
    action: 'แก้ไขข้อมูลครุภัณฑ์',
    details: 'เปลี่ยนสถานที่ตั้งจาก Main Office ไปยัง Meeting Rm A และปรับจำนวนเป็น 5 ตัว',
    user: 'Somsak',
    timestamp: '2023-10-14T14:30:00Z'
  },
  {
    id: 'log-3',
    itemId: 'item-3',
    itemName: 'Epson Projector',
    action: 'แจ้งซ่อมแซม (Status Change)',
    details: 'อัปเดตสถานะเป็น ชำรุด (DAMAGED) เนื่องจากหลอดภาพขาด',
    user: 'Somchai',
    timestamp: '2023-10-12T09:15:00Z'
  },
  {
    id: 'log-4',
    itemId: 'item-4',
    itemName: 'HP LaserJet Pro',
    action: 'ตรวจสอบสภาพครุภัณฑ์ (Audited)',
    details: 'ตรวจสภาพ: ใช้งานได้ปกติ เปลี่ยนตลับหมึกใหม่ทั้งสองเครื่อง',
    user: 'Admin',
    timestamp: '2023-10-10T11:45:00Z'
  }
];

export const CATEGORIES = [
  'IT Equipment',
  'Furniture',
  'AV',
  'Office Stationery',
  'Kitchen Appliances',
  'Others'
];

export const LOCATIONS = [
  'Main Office',
  'Meeting Rm A',
  'Meeting Rm B',
  'Storage B',
  'Hallway',
  'Executive Suite',
  'Reception'
];

export const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'ใช้งานอยู่ (ACTIVE)', color: 'bg-green-100 text-green-700 border-green-200 ring-green-500' },
  { value: 'IN STOCK', label: 'ในคลัง (IN STOCK)', color: 'bg-blue-100 text-blue-700 border-blue-200 ring-blue-500' },
  { value: 'DAMAGED', label: 'ชำรุด (DAMAGED)', color: 'bg-red-100 text-red-700 border-red-200 ring-red-500' },
  { value: 'BORROWED', label: 'ถูกยืม (BORROWED)', color: 'bg-yellow-100 text-yellow-700 border-yellow-200 ring-yellow-500' },
  { value: 'RETIRED', label: 'จำหน่ายออก (RETIRED)', color: 'bg-gray-100 text-gray-700 border-gray-200 ring-gray-500' }
];
