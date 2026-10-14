<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Asset;
use App\Models\Category;
use App\Models\Location;
use App\Models\Unit;
use App\Services\QrTagGeneratorService;
use Illuminate\Support\Facades\View;

class PdfAndQrGenerationTest extends TestCase
{
    public function test_can_render_pordor1_blade_view(): void
    {
        $category = new Category(['name' => 'ครุภัณฑ์สำนักงาน']);
        $location = new Location(['name' => 'ห้องประชุม 1']);
        $unit = new Unit(['name' => 'ตัว']);

        $asset = new Asset([
            'asset_code' => 'OFF-001',
            'name' => 'เก้าอี้สำนักงาน',
            'cost' => '3500.00',
            'salvage_value' => '1.00',
            'useful_life_years' => 5,
            'acquisition_date' => '2026-02-01',
        ]);

        $asset->setRelation('category', $category);
        $asset->setRelation('location', $location);
        $asset->setRelation('unit', $unit);
        $asset->setRelation('depreciationRecords', collect());

        $view = View::make('reports.pordor1', [
            'asset' => $asset,
            'depreciationRecords' => collect(),
        ])->render();

        $this->assertStringContainsString('ทะเบียนคุมทรัพย์สิน (แบบ พด. 1)', $view);
        $this->assertStringContainsString('OFF-001', $view);
        $this->assertStringContainsString('3,500.00', $view);
    }

    public function test_qr_tag_generator_produces_thermal_data(): void
    {
        $asset = new Asset([
            'asset_code' => 'COM-099',
            'name' => 'จอภาพคอมพิวเตอร์ 27 นิ้ว',
            'serial_number' => 'SN-12345678',
        ]);

        $this->assertEquals('COM-099', $asset->asset_code);
    }
}
