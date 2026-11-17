import type { UATScenario } from './types'

export const VIEWER_SCENARIOS: UATScenario[] = [
  {
    id: 'TC-VIW-01',
    role: 'viewer',
    title: 'การเรียกดูรายการพัสดุและแดชบอร์ดแบบอ่านอย่างเดียว (Read-Only Browsing)',
    goal: 'ผู้เข้าชม (Viewer) เดินทางดูหน้า /dashboard และ /items ตรวจสอบข้อมูลพัสดุและค่าเสื่อมราคาโดยไม่สามารถทำการเปลี่ยนแปลงใดๆ ได้',
    successCriteria: [
      'สามารถดูข้อมูลบนแดชบอร์ดและตารางพัสดุได้ครบถ้วน',
      'ค่าเสื่อมราคาและข้อมูลพัสดุแสดงผลถูกต้อง',
    ],
    maxSteps: 10,
  },
  {
    id: 'TC-VIW-02',
    role: 'viewer',
    title: 'การป้องกันการเปลี่ยนแปลงข้อมูลของผู้เข้าชม (Mutation Protection)',
    goal: 'ยืนยันว่าผู้เข้าชมไม่มีปุ่ม "เพิ่มพัสดุ" และไม่มีปุ่ม "แก้ไข/ลบ" ใดๆ หากพิมพ์ URL เข้า /items/new หรือ /admin โดยตรง ต้องถูกปฏิเสธทันที',
    successCriteria: [
      'ไม่มีปุ่ม "เพิ่มพัสดุ" ในหน้า /items',
      'ไม่มีปุ่มแก้ไขหรือลบในตาราง',
      'การเข้า /items/new หรือ /admin โดยตรงถูก Redirect หรือปฏิเสธการเข้าถึง',
    ],
    maxSteps: 12,
  },
]
