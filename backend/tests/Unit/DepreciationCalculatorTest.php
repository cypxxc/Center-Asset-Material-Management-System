<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Models\Asset;
use App\Services\DepreciationCalculatorService;

class DepreciationCalculatorTest extends TestCase
{
    public function test_pro_rata_mid_year_depreciation(): void
    {
        $calculator = new DepreciationCalculatorService();

        // Asset acquired mid-fiscal year 2569 on 2026-04-01
        // Fiscal year 2569: Oct 1, 2025 - Sep 30, 2026 (365 days)
        // Days from 2026-04-01 to 2026-09-30 = 183 days
        $asset = new Asset([
            'cost' => '100000.00',
            'salvage_value' => '1.00',
            'useful_life_years' => 5,
            'acquisition_date' => '2026-04-01',
        ]);

        $result = $calculator->calculateForFiscalYear($asset, 2569);

        // Annual depreciation full year = 99999 / 5 = 19999.80
        // Half year (183/365) approx 10027.29
        $this->assertGreaterThan('9000.00', $result['annual_depreciation']);
        $this->assertLessThan('12000.00', $result['annual_depreciation']);
        $this->assertGreaterThan('1.00', $result['net_book_value']);
    }

    public function test_fully_depreciated_asset_floors_at_one_baht(): void
    {
        $calculator = new DepreciationCalculatorService();

        $asset = new Asset([
            'cost' => '10000.00',
            'salvage_value' => '1.00',
            'useful_life_years' => 1,
            'acquisition_date' => '2024-10-01',
        ]);

        $result = $calculator->calculateForFiscalYear($asset, 2569);

        // Net book value should be exactly 1.00 THB floor
        $this->assertEquals('1.00', $result['net_book_value']);
        $this->assertEquals('9999.00', $result['accumulated_depreciation']);
    }
}
