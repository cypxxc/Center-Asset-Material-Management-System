<?php

namespace App\Http\Controllers;

use App\Models\AuditSession;
use App\Models\AuditCheck;
use App\Models\Asset;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\RedirectResponse;

class AuditCheckController extends Controller
{
    public function scanView(Request $request): Response
    {
        $activeSession = AuditSession::where('status', 'open')->latest()->first();

        $asset = null;
        $existingCheck = null;

        if ($request->filled('asset_code')) {
            $asset = Asset::with(['category', 'location', 'unit'])
                ->where('asset_code', $request->input('asset_code'))
                ->first();

            if ($asset && $activeSession) {
                $existingCheck = AuditCheck::where('audit_session_id', $activeSession->id)
                    ->where('asset_id', $asset->id)
                    ->first();
            }
        }

        return Inertia::render('Audit/Scan', [
            'activeSession' => $activeSession,
            'scannedAsset' => $asset,
            'existingCheck' => $existingCheck,
        ]);
    }

    public function recordCheckIn(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'audit_session_id' => ['required', 'exists:audit_sessions,id'],
            'asset_id' => ['required', 'exists:assets,id'],
            'status' => ['required', 'in:found,damaged,missing,relocated'],
            'remarks' => ['nullable', 'string', 'max:500'],
        ]);

        // Upsert to handle both fresh check-in and update without violating UNIQUE constraint
        AuditCheck::updateOrCreate(
            [
                'audit_session_id' => $validated['audit_session_id'],
                'asset_id' => $validated['asset_id'],
            ],
            [
                'status' => $validated['status'],
                'remarks' => $validated['remarks'] ?? null,
                'checked_by' => $request->user()->id,
                'checked_at' => now(),
            ]
        );

        return redirect()->route('audit.scan')->with('success', 'บันทึกการตรวจนับครุภัณฑ์สำเร็จ');
    }
}
