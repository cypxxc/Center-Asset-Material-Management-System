# สร้างผู้ใช้ผ่าน Navicat

เชื่อมต่อ `camms_registry` ด้วยบัญชีเจ้าของฐานข้อมูลจาก `.env.postgres.local`
บนเครื่องนี้ใช้ `127.0.0.1:15432` ไม่ใช่บัญชี runtime `camms_app` / `camms_auth`

หลังอัปเดตระบบ ให้ปิดและเปิดตาราง `public.profiles` ใหม่ หรือ refresh โครงสร้าง
จะมีคอลัมน์ `password` ให้กรอกได้

## เพิ่มบัญชี

กดเพิ่มแถว กรอก `full_name`, `role` (`admin` หรือ `user`), `is_active=true`
และ `password` จากนั้นบันทึก อีเมลเว้นว่างได้ ส่วน `id` ให้ DB สร้าง UUID ตาม default
ใช้ `full_name` ที่ไม่ซ้ำเพื่อเข้าสู่ระบบด้วยชื่อได้แน่นอน

ตัวอย่างผ่าน New Query (เปลี่ยนค่าตัวอย่างก่อนรัน):

```sql
INSERT INTO public.profiles (full_name, role, is_active, password)
VALUES ('F00069', 'user', true, 'Replace-With-Your-Password');
```

## เปลี่ยนรหัสผ่าน

กรอกค่าใหม่ในช่อง `password` ของแถวที่ต้องการแล้วบันทึก หรือใช้ UUID เพื่อระบุบัญชี:

```sql
UPDATE public.profiles
SET password = 'Replace-With-New-Password'
WHERE id = 'ใส่ UUID ของผู้ใช้';
```

- รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร และไม่เกิน 72 ไบต์ UTF-8 (ภาษาไทยใช้หลายไบต์)
- หลังบันทึก `password` จะเป็น `NULL` เสมอ เป็นการทำงานปกติ: trigger แปลงเป็น bcrypt cost 12 แล้วเก็บใน `private_auth.credentials.password_hash`
- เว้นว่างหรือใส่ `NULL` หมายถึงไม่เปลี่ยนรหัสผ่านเดิม บัญชีใหม่ที่เว้นว่างจะยังไม่มีรหัสผ่านสำหรับ login
- การเปลี่ยนรหัสผ่านจะยกเลิก session เดิมของผู้ใช้นั้น
- รหัสผ่าน scrypt ของบัญชีเดิมยังใช้ได้ ไม่ต้องตั้งใหม่
- คอลัมน์นี้รับข้อมูลจากเจ้าของตารางเท่านั้น ไม่เพิ่มสิทธิ์ให้ role ของเว็บ
- คำสั่งใน Query History ของ Navicat อาจมีรหัสผ่านที่พิมพ์ไว้ ใช้ table editor หากไม่ต้องการเก็บคำสั่งเหล่านั้น และจัดการประวัติตามนโยบายของหน่วยงาน

Migration `0001_navicat_password_input.sql` เพิ่ม pgcrypto และกำหนด FK ของ credentials
เป็น deferred เพื่อตรวจความสัมพันธ์ตอน commit ทำให้ trigger สร้างข้อมูลทั้งสองตาราง
ได้ใน transaction เดียว แม้เพิ่มผ่าน table editor แบบ autocommit
