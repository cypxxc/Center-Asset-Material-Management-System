# Permanent Deletion Consistency Design

## Goal

ทำให้ทุกเส้นทางลบรายการสอดคล้องกับ migration 35 ที่ใช้การลบถาวร และทำให้ชุดทดสอบการสร้างรายการรองรับข้อมูลค่าเสื่อมที่เพิ่มเข้ามา

## Changes

- เปลี่ยน action ลบรายการเดี่ยวที่ยังตั้ง `deleted_at` ให้เรียกการลบถาวรที่มีอยู่
- ถอด action กู้คืนและ bulk restore ที่ไม่สามารถทำงานได้หลังลบถาวร พร้อมตรวจ reference ที่เกี่ยวข้อง
- คงการตรวจสิทธิ์ staff/admin, audit log และการลบรูปภาพใน Storage ของเส้นทางลบถาวร
- ปรับ assertion ของ test การสร้างรายการให้รวมฟิลด์ค่าเสื่อมที่เป็นค่าเริ่มต้น

## Verification

- ตรวจว่าไม่มี action หรือ UI อ้างถึง soft delete/restore
- รัน typecheck, lint และ `npm test` ให้ผ่านทั้งหมด
