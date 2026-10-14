<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Models\Category;
use App\Models\Location;
use App\Models\Unit;
use App\Models\Asset;
use App\Models\Material;

class ModelRelationshipTest extends TestCase
{
    public function test_asset_and_material_relations_and_soft_deletes(): void
    {
        $category = Category::create(['name' => 'ครุภัณฑ์ยานพาหนะ', 'type' => 'asset']);
        $location = Location::create(['name' => 'อาคารจอดรถ']);
        $unit = Unit::create(['name' => 'คัน']);

        $asset = Asset::create([
            'asset_code' => 'CAR-001',
            'name' => 'รถตู้ส่วนกลาง',
            'category_id' => $category->id,
            'location_id' => $location->id,
            'unit_id' => $unit->id,
            'cost' => '1200000.00',
            'salvage_value' => '1.00',
            'useful_life_years' => 8,
            'acquisition_date' => '2026-01-15',
        ]);

        $this->assertEquals($category->id, $asset->category->id);
        $this->assertEquals($location->id, $asset->location->id);
        $this->assertEquals($unit->id, $asset->unit->id);

        // Soft delete test
        $asset->delete();
        $this->assertSoftDeleted($asset);
        $this->assertNotNull($asset->deleted_at);

        // Material low stock test
        $material = Material::create([
            'sku' => 'PEN-BLUE',
            'name' => 'ปากกาลูกลื่นสีน้ำเงิน',
            'category_id' => $category->id,
            'location_id' => $location->id,
            'unit_id' => $unit->id,
            'unit_price' => '15.00',
            'current_quantity' => 2,
            'min_stock_level' => 5,
        ]);

        $this->assertTrue($material->isLowStock());
    }
}
