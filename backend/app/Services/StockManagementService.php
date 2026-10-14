<?php

namespace App\Services;

use App\Models\Material;
use App\Models\StockTransaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use DomainException;

class StockManagementService
{
    /**
     * Executes atomic stock transaction with row-level lock.
     */
    public function recordTransaction(
        Material $material,
        string $type,
        int $quantity,
        string $unitPrice,
        User $user,
        ?string $notes = null
    ): StockTransaction {
        if ($quantity <= 0 && $type !== 'ADJUST') {
            throw new DomainException('Transaction quantity must be greater than zero.');
        }

        return DB::transaction(function () use ($material, $type, $quantity, $unitPrice, $user, $notes) {
            /** @var Material $lockedMaterial */
            $lockedMaterial = Material::where('id', $material->id)
                ->lockForUpdate()
                ->firstOrFail();

            $currentStock = $lockedMaterial->current_quantity;
            $newStock = $currentStock;

            switch (strtoupper($type)) {
                case 'IN':
                    $newStock = $currentStock + $quantity;
                    break;

                case 'OUT':
                    if ($currentStock < $quantity) {
                        throw new DomainException(
                            "Insufficient stock for SKU: {$lockedMaterial->sku}. Available: {$currentStock}, requested: {$quantity}."
                        );
                    }
                    $newStock = $currentStock - $quantity;
                    break;

                case 'ADJUST':
                    if ($quantity < 0) {
                        throw new DomainException('Adjusted stock quantity cannot be negative.');
                    }
                    $newStock = $quantity;
                    break;

                default:
                    throw new DomainException("Invalid stock transaction type: {$type}");
            }

            // Create immutable stock transaction record
            $transaction = StockTransaction::create([
                'material_id' => $lockedMaterial->id,
                'type' => strtoupper($type),
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'user_id' => $user->id,
                'notes' => $notes,
            ]);

            // Update material stock balance
            $lockedMaterial->update([
                'current_quantity' => $newStock,
                'unit_price' => $unitPrice,
            ]);

            return $transaction;
        });
    }
}
