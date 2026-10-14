<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Models\Asset;
use App\Models\DepreciationRecord;
use App\Services\DepreciationCalculatorService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CalculateFiscalYearDepreciationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public int $fiscalYear
    ) {}

    public function handle(DepreciationCalculatorService $calculator): void
    {
        Log::info("Starting annual depreciation calculation for Thai Fiscal Year: {$this->fiscalYear}");

        Asset::whereNull('deleted_at')
            ->where('status', 'active')
            ->chunkById(100, function ($assets) use ($calculator) {
                foreach ($assets as $asset) {
                    $result = $calculator->calculateForFiscalYear($asset, $this->fiscalYear);

                    // Idempotent upsert by (asset_id, fiscal_year)
                    DB::table('depreciation_records')->upsert(
                        [
                            'asset_id' => $asset->id,
                            'fiscal_year' => $this->fiscalYear,
                            'annual_depreciation' => $result['annual_depreciation'],
                            'accumulated_depreciation' => $result['accumulated_depreciation'],
                            'net_book_value' => $result['net_book_value'],
                            'created_at' => now(),
                            'updated_at' => now(),
                        ],
                        ['asset_id', 'fiscal_year'],
                        ['annual_depreciation', 'accumulated_depreciation', 'net_book_value', 'updated_at']
                    );
                }
            });

        Log::info("Finished annual depreciation calculation for Thai Fiscal Year: {$this->fiscalYear}");
    }
}
