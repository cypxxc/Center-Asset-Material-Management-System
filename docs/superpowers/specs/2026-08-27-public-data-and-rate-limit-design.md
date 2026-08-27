# Public Data and Rate Limit Design

## Goal

ลดการเปิดเผยข้อมูลจาก QR public view และทำให้ rate limit ใช้งานได้สอดคล้องเมื่อมีหลาย application instance

## Public View

- แยก query สำหรับ public item view ออกจาก query รายละเอียดภายใน
- public view ส่งเฉพาะข้อมูลที่จำเป็นต่อการระบุครุภัณฑ์: ชื่อ, เลขครุภัณฑ์/serial, ประเภท, สถานะ และรูปภาพ
- ไม่ส่งราคา, ผู้รับผิดชอบ, สถานที่, หมายเหตุ หรือข้อมูลค่าเสื่อมไปยังผู้ที่ไม่ได้เข้าสู่ระบบ

## Rate Limit

- เปลี่ยน rate limiter ให้รองรับ shared backend เมื่อมีการตั้งค่า Redis-compatible endpoint
- คง fallback แบบ memory สำหรับ local development เท่านั้น พร้อมระบุข้อจำกัดให้ชัด
- ไม่เปิดเผย credential ไปยัง client

## Verification

- เพิ่ม test ว่า public projection ไม่มีข้อมูลอ่อนไหว
- เพิ่ม test เลือก shared limiter เมื่อมี environment configuration
- รัน typecheck, lint และ test ที่เกี่ยวข้อง
