# SSO, Locations, and Trash Cleanup Design

## Goal

แก้ไขปัญหา SSO ที่ค้นหาผู้ใช้ได้ไม่ครบเมื่อจำนวนผู้ใช้มากขึ้น ลด network waterfall ในหน้า Locations และนำโค้ดถังขยะที่เลิกใช้ออก

## SSO Lookup

- ค้นหา `public.profiles` ด้วยอีเมลที่ normalize แล้ว (`select id`, `maybeSingle`) ก่อนเสมอ โดยใช้ unique constraint ของ `profiles.email`
- เมื่อพบ profile ใช้ `id` นั้นอัปเดต metadata ของผู้ใช้ใน Supabase Auth
- เมื่อไม่พบ profile ให้สร้างผู้ใช้ Auth ตามกระบวนการ auto-provision เดิม แล้ว upsert profile
- หากการสร้าง Auth แจ้งว่าอีเมลมีอยู่แล้ว แต่ profile หายไป ให้ส่งข้อผิดพลาดที่ชัดเจนแทนการสร้างข้อมูลซ้ำหรือเลือกผู้ใช้ผิดราย การกู้คืน profile เป็นงานผู้ดูแลระบบแยกต่างหาก
- ไม่ใช้ `listUsers` ใน SSO callback อีกต่อไป จึงไม่ขึ้นกับ pagination หรือจำนวนผู้ใช้ทั้งหมด

## Locations Query

- หลังตรวจสอบ session แล้ว เริ่ม query `locations` และ `items` พร้อมกันด้วย `Promise.all`
- คง query, filter, ลำดับ และ error handling เดิมไว้ เพื่อเปลี่ยนเฉพาะ latency

## Trash Cleanup

- ลบ `app/(dashboard)/items/trash-explorer-client.tsx` และ types/query `getDeletedItems` ที่ไม่ได้ถูกเรียกใช้
- ไม่กระทบการลบรายการปัจจุบัน ซึ่งใช้ direct delete ตาม migration 35

## Verification

- เพิ่ม unit test สำหรับเส้นทาง SSO: พบ profile, ไม่พบแล้วสร้างใหม่, และ Auth ซ้ำแต่ profile หาย
- ตรวจ typecheck, lint และค้นหา reference ว่าไม่มีการอ้างถึงโค้ดถังขยะ
