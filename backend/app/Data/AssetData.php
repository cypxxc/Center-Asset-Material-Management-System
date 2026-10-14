<?php

namespace App\Data;

use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
class AssetData extends Data
{
    public function __construct(
        public ?int $id,
        public string $asset_code,
        public ?string $serial_number,
        public string $name,
        public int $category_id,
        public int $location_id,
        public int $unit_id,
        public string $cost,
        public string $salvage_value,
        public int $useful_life_years,
        public string $acquisition_date,
        public string $status,
        public ?string $image_url,
        public ?string $category_name = null,
        public ?string $location_name = null,
        public ?string $unit_name = null,
    ) {}
}
