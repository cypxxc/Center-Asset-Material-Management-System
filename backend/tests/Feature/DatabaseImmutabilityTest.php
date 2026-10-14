<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\Category;
use App\Models\Location;
use App\Models\Unit;
use App\Models\Asset;
use App\Models\Material;

class DatabaseImmutabilityTest extends TestCase
{
    public function test_cannot_update_or_delete_depreciation_records(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $category = Category::create(['name' => 'เครื่องคอมพิวเตอร์', 'type' => 'asset']);
        $location = Location::create(['name' => 'ห้อง 401']);
        $unit = Unit::create(['name' => 'เครื่อง']);

        $asset = Asset::create([
            'asset_code' => 'COM-2569-001',
            'name' => 'เครื่องคอมพิวเตอร์แม่ข่าย',
            'category_id' => $category->id,
            'location_id' => $location->id,
            'unit_id' => $unit->id,
            'cost' => '50000.00',
            'salvage_value' => '1.00',
            'useful_life_years' => 5,
            'acquisition_date' => '2026-10-01',
        ]);

        $depreciationId = DB::table('depreciation_records')->insertGetId([
            'asset_id' => $asset->id,
            'fiscal_year' => 2569,
            'annual_depreciation' => '9999.80',
            'accumulated_depreciation' => '9999.80',
            'net_book_value' => '40000.20',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Expect exception when attempting to update
        $this->expectException(\Illuminate\Database\QueryException::class);
        DB::table('depreciation_records')->where('id', $depreciationId)->update(['net_book_value' => '30000.00']);
    }

    public function test_cannot_delete_stock_transactions(): void
    {
        $user = User::factory()->create(['role' => 'staff']);
        $category = Category::create(['name' => 'วัสดุสำนักงาน', 'type' => 'material']);
        $location = Location::create(['name' => 'คลังพัสดุ']);
        $unit = Unit::create(['name' => 'รีม']);

        $material = Material::create([
            'sku' => 'PAP-A4-70G',
            'name' => 'กระดาษ A4 70 แกรม',
            'category_id' => $category->id,
            'location_id' => $location->id,
            'unit_id' => $unit->id,
            'unit_price' => '120.00',
            'current_quantity' => 10,
        ]);

        $txId = DB::table('stock_transactions')->insertGetId([
            'material_id' => $material->id,
            'type' => 'IN',
            'quantity' => 10,
            'unit_price' => '120.00',
            'user_id' => $user->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Expect exception when attempting to delete
        $this->expectException(\Illuminate\Database\QueryException::class);
        DB::table('stock_transactions')->where('id', $txId)->delete();
    }
}
