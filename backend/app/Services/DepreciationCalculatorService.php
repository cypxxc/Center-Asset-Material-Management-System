<?php

namespace App\Services;

use App\Models\Asset;
use Carbon\Carbon;

class DepreciationCalculatorService
{
    /**
     * Calculates depreciation for a given asset in a specified Thai fiscal year (e.g. 2569).
     *
     * @param Asset $asset
     * @param int $thaiFiscalYear e.g. 2569
     * @return array{annual_depreciation: string, accumulated_depreciation: string, net_book_value: string}
     */
    public function calculateForFiscalYear(Asset $asset, int $thaiFiscalYear): array
    {
        // Thai Fiscal Year 2569 = Oct 1, 2025 to Sep 30, 2026
        $adYear = $thaiFiscalYear - 543;
        $fiscalStart = Carbon::create($adYear - 1, 10, 1)->startOfDay();
        $fiscalEnd = Carbon::create($adYear, 9, 30)->endOfDay();
        $totalDaysInFiscalYear = $fiscalStart->diffInDays($fiscalEnd) + 1; // 365 or 366

        $cost = (string) $asset->cost;
        $salvage = (string) $asset->salvage_value;
        $usefulLife = (string) $asset->useful_life_years;

        // Base annual straight-line depreciation = (Cost - Salvage) / UsefulLife
        $depreciableAmount = bcsub($cost, $salvage, 4);
        $fullAnnualDepreciation = bcdiv($depreciableAmount, $usefulLife, 4);

        $acqDate = Carbon::parse($asset->acquisition_date)->startOfDay();

        // If acquired after this fiscal year ended, 0 depreciation
        if ($acqDate->gt($fiscalEnd)) {
            return [
                'annual_depreciation' => '0.00',
                'accumulated_depreciation' => '0.00',
                'net_book_value' => number_format((float)$cost, 2, '.', ''),
            ];
        }

        // Pro-rata mid-year calculation if acquired during this fiscal year
        if ($acqDate->gte($fiscalStart) && $acqDate->lte($fiscalEnd)) {
            $daysHeld = $acqDate->diffInDays($fiscalEnd) + 1; // inclusive
            $ratio = bcdiv((string)$daysHeld, (string)$totalDaysInFiscalYear, 6);
            $annualDepreciation = bcmul($fullAnnualDepreciation, $ratio, 4);
        } else {
            $annualDepreciation = $fullAnnualDepreciation;
        }

        // Calculate past accumulated depreciation before this year
        $pastAccumulated = $this->getPastAccumulatedDepreciation($asset, $thaiFiscalYear);

        // Projected accumulated = pastAccumulated + annualDepreciation
        $projectedAccumulated = bcadd($pastAccumulated, $annualDepreciation, 4);

        // Max allowable depreciation before hitting the 1.00 THB floor
        // Max Depreciation = Cost - 1.00 THB (or salvage value, whichever is higher, default 1.00 THB)
        $floor = bccomp($salvage, '1.00', 2) > 0 ? $salvage : '1.00';
        $maxAllowableAccumulated = bcsub($cost, $floor, 4);

        if (bccomp($projectedAccumulated, $maxAllowableAccumulated, 4) > 0) {
            // Cap to floor
            $adjustedAccumulated = $maxAllowableAccumulated;
            $annualDepreciation = bcsub($adjustedAccumulated, $pastAccumulated, 4);
            if (bccomp($annualDepreciation, '0.00', 4) < 0) {
                $annualDepreciation = '0.00';
            }
        } else {
            $adjustedAccumulated = $projectedAccumulated;
        }

        $netBookValue = bcsub($cost, $adjustedAccumulated, 2);

        // Ensure net book value is never below floor for active assets
        if (bccomp($netBookValue, $floor, 2) < 0) {
            $netBookValue = number_format((float)$floor, 2, '.', '');
        }

        return [
            'annual_depreciation' => number_format((float)$annualDepreciation, 2, '.', ''),
            'accumulated_depreciation' => number_format((float)$adjustedAccumulated, 2, '.', ''),
            'net_book_value' => number_format((float)$netBookValue, 2, '.', ''),
        ];
    }

    protected function getPastAccumulatedDepreciation(Asset $asset, int $currentFiscalYear): string
    {
        $lastRecord = $asset->depreciationRecords()
            ->where('fiscal_year', '<', $currentFiscalYear)
            ->orderByDesc('fiscal_year')
            ->first();

        return $lastRecord ? (string)$lastRecord->accumulated_depreciation : '0.00';
    }
}
