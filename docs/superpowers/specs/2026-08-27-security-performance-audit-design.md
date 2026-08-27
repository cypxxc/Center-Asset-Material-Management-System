# Security and Performance Audit Design

## Scope

ตรวจสอบแบบอ่านอย่างเดียว ครอบคลุม Supabase RLS และสิทธิ์, service-role usage, SSO/API, การลบข้อมูล, query/index/realtime, bundle และ release gate

## Output

รายงานหลักฐานตามระดับ Critical, High และ Medium พร้อมผลกระทบและแนวทางแก้ที่ไม่ทำลายข้อมูล โดยไม่เปลี่ยนโค้ดหรือฐานข้อมูลในรอบ audit นี้
