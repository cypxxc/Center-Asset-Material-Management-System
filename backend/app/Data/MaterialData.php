<?php

namespace App\Data;

use Spatie\LaravelData\Data;
use Spatie\TypeScriptTransformer\Attributes\TypeScript;

#[TypeScript]
class MaterialData extends Data
{
    public function __construct(
        public ?int $id,
        public string $sku,
        public string $name,
        public int $category_id,
        public int $location_id,
        public int $unit_id,
        public string $unit_price,
        public int $current_quantity,
        public int $min_stock_level,
        public bool $is_low_stock = false,
        public ?string $category_name = null,
        public ?string $location_name = null,
        public ?string $unit_name = null,
    ) {}
}
