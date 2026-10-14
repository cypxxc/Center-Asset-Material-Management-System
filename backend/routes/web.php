<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\AssetController;
use App\Http\Controllers\MaterialController;
use App\Http\Controllers\AuditCheckController;
use App\Http\Controllers\AuthController;

Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
Route::post('/login', [AuthController::class, 'login'])->name('login.post');
Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

Route::get('/', function () {
    return redirect()->route('assets.index');
});

Route::middleware(['auth'])->group(function () {
    // Assets & Durable Goods
    Route::resource('assets', AssetController::class);

    // Materials & Consumables
    Route::resource('materials', MaterialController::class);
    Route::post('/materials/{material}/transaction', [MaterialController::class, 'recordTransaction'])->name('materials.transaction');

    // Audit Sessions & Physical Inspection
    Route::get('/audit/scan', [AuditCheckController::class, 'scanView'])->name('audit.scan');
    Route::post('/audit/scan', [AuditCheckController::class, 'recordCheckIn'])->name('audit.check-in');
});
