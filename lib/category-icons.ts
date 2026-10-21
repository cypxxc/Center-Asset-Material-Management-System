import React from 'react'
import {
  Tag,
  Laptop,
  Armchair,
  FileText,
  Boxes,
  Package,
  Wrench,
  Printer,
  Car,
  Smartphone,
  Monitor,
  Book,
  Camera,
  Server,
  Building,
  Building2,
  Briefcase,
  Folder,
  Shield,
  Activity,
  Stethoscope,
  Radio,
  Zap,
  Cpu,
  HardDrive,
  Headphones,
  Tv,
  Clock,
  Compass,
  Hammer,
  Truck,
  Forklift,
  Archive,
  Layers,
  Sparkles,
  LucideProps,
} from 'lucide-react'

export interface CategoryIconOption {
  name: string
  label: string
  category: string
  component: React.ComponentType<LucideProps>
}

export const CATEGORY_ICONS: CategoryIconOption[] = [
  // Office & General
  { name: 'Tag', label: 'ป้ายชื่อทั่วไป', category: 'ทั่วไป', component: Tag },
  { name: 'Folder', label: 'โฟลเดอร์', category: 'ทั่วไป', component: Folder },
  { name: 'Archive', label: 'คลังเอกสาร', category: 'ทั่วไป', component: Archive },
  { name: 'FileText', label: 'เอกสารและแบบฟอร์ม', category: 'ทั่วไป', component: FileText },
  { name: 'Briefcase', label: 'กระเป๋าเอกสาร/สำนักงาน', category: 'ทั่วไป', component: Briefcase },
  { name: 'Book', label: 'หนังสือและตำรา', category: 'ทั่วไป', component: Book },
  { name: 'Boxes', label: 'กล่องพัสดุ', category: 'ทั่วไป', component: Boxes },
  { name: 'Package', label: 'หีบห่อพัสดุ', category: 'ทั่วไป', component: Package },
  { name: 'Layers', label: 'หมวดหมู่ซ้อน', category: 'ทั่วไป', component: Layers },

  // IT & Electronics
  { name: 'Laptop', label: 'คอมพิวเตอร์พกพา/โน้ตบุ๊ก', category: 'ไอทีและอิเล็กทรอนิกส์', component: Laptop },
  { name: 'Monitor', label: 'จอแสดงผล/จอคอมฯ', category: 'ไอทีและอิเล็กทรอนิกส์', component: Monitor },
  { name: 'Printer', label: 'เครื่องพิมพ์/สแกนเนอร์', category: 'ไอทีและอิเล็กทรอนิกส์', component: Printer },
  { name: 'Server', label: 'เซิร์ฟเวอร์/อุปกรณ์เครือข่าย', category: 'ไอทีและอิเล็กทรอนิกส์', component: Server },
  { name: 'HardDrive', label: 'ฮาร์ดไดรฟ์/อุปกรณ์จัดเก็บ', category: 'ไอทีและอิเล็กทรอนิกส์', component: HardDrive },
  { name: 'Cpu', label: 'อุปกรณ์ประมวลผล', category: 'ไอทีและอิเล็กทรอนิกส์', component: Cpu },
  { name: 'Smartphone', label: 'สมาร์ทโฟน/มือถือ', category: 'ไอทีและอิเล็กทรอนิกส์', component: Smartphone },
  { name: 'Headphones', label: 'หูฟังและไมโครโฟน', category: 'ไอทีและอิเล็กทรอนิกส์', component: Headphones },
  { name: 'Camera', label: 'กล้องถ่ายภาพ/วิดีโอ', category: 'ไอทีและอิเล็กทรอนิกส์', component: Camera },
  { name: 'Tv', label: 'โทรทัศน์/มอนิเตอร์ใหญ่', category: 'ไอทีและอิเล็กทรอนิกส์', component: Tv },
  { name: 'Radio', label: 'วิทยุสื่อสาร/โทรคมนาคม', category: 'ไอทีและอิเล็กทรอนิกส์', component: Radio },
  { name: 'Zap', label: 'อุปกรณ์ไฟฟ้ากำลัง', category: 'ไอทีและอิเล็กทรอนิกส์', component: Zap },

  // Furniture & Facilities
  { name: 'Armchair', label: 'โต๊ะ/เก้าอี้/เฟอร์นิเจอร์', category: 'เฟอร์นิเจอร์และสถานที่', component: Armchair },
  { name: 'Building', label: 'อาคารและสถานที่', category: 'เฟอร์นิเจอร์และสถานที่', component: Building },
  { name: 'Building2', label: 'สำนักงาน/หน่วยงาน', category: 'เฟอร์นิเจอร์และสถานที่', component: Building2 },

  // Vehicles, Tools & Equipment
  { name: 'Car', label: 'รถยนต์และยานพาหนะ', category: 'ยานพาหนะและเครื่องมือ', component: Car },
  { name: 'Truck', label: 'รถบรรทุก/ขนส่ง', category: 'ยานพาหนะและเครื่องมือ', component: Truck },
  { name: 'Forklift', label: 'เครื่องจักรยกของ/โฟล์คลิฟต์', category: 'ยานพาหนะและเครื่องมือ', component: Forklift },
  { name: 'Wrench', label: 'เครื่องมือช่างและซ่อมบำรุง', category: 'ยานพาหนะและเครื่องมือ', component: Wrench },
  { name: 'Hammer', label: 'เครื่องมือโรงงาน', category: 'ยานพาหนะและเครื่องมือ', component: Hammer },
  { name: 'Compass', label: 'เครื่องมือสำรวจและวิทยาศาสตร์', category: 'ยานพาหนะและเครื่องมือ', component: Compass },
  { name: 'Clock', label: 'อุปกรณ์ตรวจวัดเวลา', category: 'ยานพาหนะและเครื่องมือ', component: Clock },

  // Medical & Safety
  { name: 'Stethoscope', label: 'เครื่องมือแพทย์และการพยาบาล', category: 'การแพทย์และความปลอดภัย', component: Stethoscope },
  { name: 'Activity', label: 'เครื่องมือวิทยาศาสตร์การแพทย์', category: 'การแพทย์และความปลอดภัย', component: Activity },
  { name: 'Shield', label: 'อุปกรณ์รักษาความปลอดภัย', category: 'การแพทย์และความปลอดภัย', component: Shield },
  { name: 'Sparkles', label: 'อุปกรณ์พิเศษ/งานบ้าน', category: 'ทั่วไป', component: Sparkles },
]

export const CATEGORY_ICON_MAP: Record<string, React.ComponentType<LucideProps>> = Object.fromEntries(
  CATEGORY_ICONS.map((icon) => [icon.name, icon.component])
)

/**
 * Returns the appropriate Lucide component for a category.
 * If category has an explicitly configured icon that exists in the whitelist, uses it.
 * Otherwise, applies legacy keyword heuristic based on category name.
 * If all else fails, defaults to FileText or Tag.
 */
export function getCategoryIconComponent(
  iconName?: string | null,
  categoryName?: string
): React.ComponentType<LucideProps> {
  if (iconName && CATEGORY_ICON_MAP[iconName]) {
    return CATEGORY_ICON_MAP[iconName]
  }

  if (categoryName) {
    const n = categoryName.toLowerCase()
    // Check furniture first so that words like "เฟอร์นิเจอร์" (which contains "จอ") match Armchair
    if (
      n.includes('โต๊ะ') ||
      n.includes('เก้าอี้') ||
      n.includes('เฟอร์') ||
      n.includes('furn') ||
      n.includes('chair')
    ) {
      return Armchair
    }
    if (
      n.includes('comp') ||
      n.includes('หน้าจอ') ||
      n.includes('จอภาพ') ||
      n.includes('มอนิเตอร์') ||
      n.includes('พิมพ์') ||
      n.includes('it') ||
      n.includes('tech') ||
      n.includes('คอม')
    ) {
      return Laptop
    }
    if (
      n.includes('ยาน') ||
      n.includes('รถ') ||
      n.includes('ขนส่ง') ||
      n.includes('car') ||
      n.includes('vehicle')
    ) {
      return Car
    }
    if (
      n.includes('แพทย์') ||
      n.includes('พยาบาล') ||
      n.includes('รักษา')
    ) {
      return Stethoscope
    }
    if (
      n.includes('ไฟฟ้า') ||
      n.includes('วิทยุ') ||
      n.includes('สื่อสาร')
    ) {
      return Radio
    }
  }

  return FileText
}

export function renderCategoryIconElement(
  iconName?: string | null,
  categoryName?: string,
  props?: LucideProps
): React.ReactElement {
  const IconComp = getCategoryIconComponent(iconName, categoryName)
  return React.createElement(IconComp, props)
}
