<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>เข้าสู่ระบบ | CAMMS Portal</title>

    <!-- Google Fonts: Capriola & Sarabun -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Capriola&family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Sarabun', 'sans-serif'],
                        brand: ['Capriola', 'sans-serif'],
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-slate-100 min-h-screen flex items-center justify-center p-4">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div class="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white text-center">
            <h1 class="text-2xl font-brand font-bold tracking-wide">CAMMS</h1>
            <p class="text-xs text-blue-200 mt-1">Center Asset & Material Management System</p>
        </div>

        <div class="p-8">
            <h2 class="text-xl font-bold text-slate-800 mb-6 text-center">เข้าสู่ระบบจัดการครุภัณฑ์และวัสดุ</h2>

            @if ($errors->any())
                <div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                    {{ $errors->first() }}
                </div>
            @endif

            <form method="POST" action="{{ route('login.post') }}" class="space-y-5">
                @csrf
                <div>
                    <label for="email" class="block text-sm font-medium text-slate-700 mb-1">อีเมลผู้ใช้งาน</label>
                    <input 
                        type="email" 
                        name="email" 
                        id="email" 
                        value="{{ old('email', 'admin@camms.local') }}" 
                        required 
                        autofocus
                        class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm text-slate-900"
                        placeholder="admin@camms.local"
                    >
                </div>

                <div>
                    <label for="password" class="block text-sm font-medium text-slate-700 mb-1">รหัสผ่าน</label>
                    <input 
                        type="password" 
                        name="password" 
                        id="password" 
                        value="password"
                        required 
                        class="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm text-slate-900"
                        placeholder="••••••••"
                    >
                </div>

                <div class="flex items-center justify-between text-sm">
                    <label class="flex items-center text-slate-600 cursor-pointer">
                        <input type="checkbox" name="remember" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500">
                        <span class="ml-2 text-xs">จดจำการเข้าสู่ระบบ</span>
                    </label>
                    <span class="text-xs text-slate-400">เริ่มต้น: admin@camms.local / password</span>
                </div>

                <button 
                    type="submit" 
                    class="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium py-2.5 px-4 rounded-lg transition duration-200 shadow-md hover:shadow-lg text-sm"
                >
                    เข้าสู่ระบบ
                </button>
            </form>
        </div>
        <div class="bg-slate-50 border-t border-slate-100 px-8 py-3 text-center text-xs text-slate-400">
            ระบบบริหารจัดการพัสดุ ครุภัณฑ์ และวัสดุภาครัฐ (CAMMS)
        </div>
    </div>
</body>
</html>
