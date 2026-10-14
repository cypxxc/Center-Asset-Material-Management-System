<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;

Route::get('/health/status', function () {
    try {
        DB::connection()->getPdo();
        $dbStatus = 'connected';
    } catch (\Throwable $e) {
        $dbStatus = 'disconnected';
    }

    return response()->json([
        'status' => 'healthy',
        'database' => $dbStatus,
        'app' => 'CAMMS Portal Backend (Laravel 11)',
        'timestamp' => now()->toIso8601String(),
    ]);
});
