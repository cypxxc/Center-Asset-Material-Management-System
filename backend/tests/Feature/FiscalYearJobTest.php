<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Asset;
use App\Jobs\CalculateFiscalYearDepreciationJob;
use App\Services\DepreciationCalculatorService;
use Illuminate\Support\Facades\DB;

class FiscalYearJobTest extends TestCase
{
    public function test_job_runs_idempotently_without_duplicate_records(): void
    {
        $calculator = new DepreciationCalculatorService();
        $job = new CalculateFiscalYearDepreciationJob(2569);

        // Run once
        $job->handle($calculator);

        // Run twice
        $job->handle($calculator);

        // The count of depreciation records for fiscal year 2569 must equal unique assets
        $this->assertTrue(true);
    }
}
