<?php

use Illuminate\Support\Facades\Schedule;
use App\Jobs\CalculateFiscalYearDepreciationJob;

// Thai Fiscal Year (Oct 1 - Sep 30) annual depreciation run at midnight of Sep 30th
Schedule::job(new CalculateFiscalYearDepreciationJob(fiscalYear: now()->year + 543))
    ->yearlyOn(9, 30, '23:59')
    ->timezone('Asia/Bangkok')
    ->withoutOverlapping();
