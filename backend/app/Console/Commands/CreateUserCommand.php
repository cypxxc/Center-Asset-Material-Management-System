<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CreateUserCommand extends Command
{
    protected $signature = 'camms:create-user 
                            {--name= : ชื่อ-นามสกุล ของผู้ใช้งาน}
                            {--email= : อีเมลผู้ใช้งาน}
                            {--password= : รหัสผ่าน}
                            {--role=admin : บทบาท (admin หรือ staff)}';

    protected $description = 'สร้างบัญชีผู้ใช้งานใหม่ในระบบ CAMMS (Admin หรือ Staff)';

    public function handle(): int
    {
        $name = $this->option('name') ?: $this->ask('กรุณาระบุชื่อ-นามสกุล (เช่น ผู้ดูแลระบบ):');
        $email = $this->option('email') ?: $this->ask('กรุณาระบุอีเมล (เช่น admin@camms.local):');
        $password = $this->option('password') ?: $this->secret('กรุณาระบุรหัสผ่าน (อย่างน้อย 6 ตัวอักษร):');
        $role = $this->option('role');

        if (!in_array($role, ['admin', 'staff'])) {
            $role = $this->choice('เลือกบทบาทของผู้ใช้:', ['admin', 'staff'], 0);
        }

        $validator = Validator::make([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'role' => $role,
        ], [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|min:6',
            'role' => 'required|in:admin,staff',
        ], [
            'email.unique' => 'อีเมลนี้ถูกใช้งานในระบบแล้ว',
            'password.min' => 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร',
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error("❌ {$error}");
            }
            return self::FAILURE;
        }

        $user = User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make($password),
            'role' => $role,
            'is_active' => true,
        ]);

        $this->newLine();
        $this->info("✅ สร้างบัญชีผู้ใช้สำเร็จเรียบร้อยแล้ว!");
        $this->table(
            ['ID', 'ชื่อ-นามสกุล', 'อีเมล', 'บทบาท', 'สถานะ'],
            [[$user->id, $user->name, $user->email, strtoupper($user->role), 'เปิดใช้งาน (Active)']]
        );

        return self::SUCCESS;
    }
}
