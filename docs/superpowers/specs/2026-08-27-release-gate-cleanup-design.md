# Release Gate Cleanup Design

## Goal

ทำให้การลบหลายรายการลบรูปภาพที่เกี่ยวข้องด้วย และทำให้ชุดทดสอบกับ build gate ผ่านหลังการเพิ่มค่าเสื่อมและปรับคู่มือ

## Changes

- ให้ bulk delete อ่านรายการและ URL รูปภาพก่อนลบ จากนั้นลบรูปภาพแบบ best-effort หลังลบฐานข้อมูลสำเร็จ
- ปรับ test การสร้างรายการให้รองรับฟิลด์ค่าเสื่อมเริ่มต้น
- คง Header Guide เป็น dynamic import และปรับ test ให้ตรวจการ defer โดยไม่ยึดข้อความเก่า
- ตรวจ bundle budget และลดเฉพาะ dependency/โค้ดที่ถูกโหลดหน้า Dashboard หากยังเกินเพดาน

## Verification

- รัน typecheck, lint, test และ build ให้ครบ
