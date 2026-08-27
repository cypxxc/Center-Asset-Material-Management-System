# Realtime Database and Dashboard Design

## Goal

ทำให้หน้า “จัดการฐานข้อมูล” และหน้าหลักของระบบ CAMMS อัปเดตข้อมูลอัตโนมัติเมื่อมีการเปลี่ยนแปลงจากผู้ใช้อื่น โดยใช้ Supabase Realtime แบบ `postgres_changes` และไม่กระทบการยืนยันตัวตนหรือสิทธิ์ RLS เดิม

## Scope

รองรับการติดตามตาราง `items`, `categories`, `locations`, `units` และ `audit_logs` สำหรับหน้าจัดการฐานข้อมูล รวมถึงหน้าสำรวจสิ่งของ, Dashboard/KPI, รายงาน และหน้าประวัติการทำรายการตามที่แต่ละหน้ามีการแสดงข้อมูลเหล่านี้อยู่แล้ว `profiles` จะไม่ subscribe เป็นข้อมูลธุรกิจ Realtime เพื่อหลีกเลี่ยงการเปิดเผยข้อมูลผู้ใช้งานเกินจำเป็น

## Architecture

- สร้าง Supabase browser client ที่ใช้ anon key และ session ของผู้ใช้ปัจจุบัน
- สร้าง hook กลางสำหรับ subscribe การเปลี่ยนแปลงของตารางที่ระบุ และเรียก callback เมื่อได้รับ event
- เพิ่มตารางที่จำเป็นเข้า publication `supabase_realtime` ใน migration โดยไม่เปลี่ยน RLS policy
- หน้า Client ใช้ event เป็นสัญญาณเรียก server query เดิมใหม่ เพื่อให้การกรอง, สิทธิ์, pagination และการคำนวณ KPI ยังคงใช้ logic ฝั่ง server
- ใช้ channel ต่อหน้าหรือกลุ่มหน้าที่เกี่ยวข้อง และ unsubscribe ใน cleanup เพื่อป้องกัน channel ค้างหรือ subscribe ซ้ำ

## Data flow

เมื่อมี `INSERT`, `UPDATE` หรือ `DELETE` ในตารางที่ subscribe อยู่ Supabase จะส่ง event ไปยัง browser ของผู้ใช้ที่มีสิทธิ์รับ event จากนั้นหน้าที่เกี่ยวข้องจะเรียก query เดิมใหม่และแทนที่ state ปัจจุบัน หากรายการที่เปลี่ยนแปลงอยู่นอกหน้าปัจจุบัน ระบบยังคงรีเฟรช count/KPI ตามความเหมาะสมโดยไม่พยายามแก้ state เฉพาะแถวแบบเสี่ยงข้อมูลไม่ตรงกับ RLS

## Reliability and UX

- แสดงสถานะเชื่อมต่อ Realtime แบบไม่รบกวนผู้ใช้ เฉพาะเมื่อเชื่อมต่อไม่ได้หรือถูกตัด
- เมื่อ reconnect ให้โหลดข้อมูลปัจจุบันใหม่หนึ่งครั้ง
- หาก Realtime ใช้งานไม่ได้ หน้ายังใช้การโหลดข้อมูลปกติและปุ่ม refresh ได้
- ป้องกัน race condition โดยไม่ให้ event เก่าทับผลลัพธ์ fetch ล่าสุด

## Security

ใช้ anon key เท่านั้นใน browser และให้ Supabase RLS เป็นตัวควบคุมการมองเห็นข้อมูล ห้ามนำ service-role key ไปฝั่ง Client การ subscribe ต้องจำกัดเฉพาะ authenticated user ตาม policy/publication ที่มีอยู่

## Verification

- ตรวจสอบว่า migration เปิด publication ให้ครบทุกตารางที่ต้องใช้
- ทดสอบเปิดสอง browser session แล้วเพิ่ม, แก้ไข และลบข้อมูลจาก session หนึ่ง
- ยืนยันว่าอีก session อัปเดตเองโดยไม่กด refresh
- ทดสอบหน้า DB panel, Items explorer, Dashboard, Reports และ Audit logs
- รัน typecheck, lint และชุดทดสอบที่เกี่ยวข้อง

