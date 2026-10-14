<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Material;
use App\Models\User;
use App\Services\StockManagementService;
use DomainException;

class StockConcurrencyTest extends TestCase
{
    public function test_cannot_deduct_more_than_available_stock(): void
    {
        $material = new Material([
            'id' => 1,
            'sku' => 'NOTEBOOK-A5',
            'current_quantity' => 5,
            'unit_price' => '25.00',
        ]);

        $user = new User(['id' => 1, 'role' => 'staff']);
        $service = new StockManagementService();

        // Attempting to withdraw 10 items when only 5 exist should throw DomainException
        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Insufficient stock for SKU: NOTEBOOK-A5');

        $service->recordTransaction($material, 'OUT', 10, '25.00', $user);
    }
}
