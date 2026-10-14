<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\AssetController;
use App\Http\Controllers\MaterialController;
use App\Http\Controllers\AuditCheckController;

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
