<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class Material extends Model
{
    use SoftDeletes, LogsActivity;

    protected $fillable = [
        'sku',
        'name',
        'category_id',
        'location_id',
        'unit_id',
        'unit_price',
        'current_quantity',
        'min_stock_level',
    ];

    protected $casts = [
        'unit_price' => 'decimal:2',
        'current_quantity' => 'integer',
        'min_stock_level' => 'integer',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['sku', 'name', 'unit_price', 'current_quantity', 'min_stock_level'])
            ->logOnlyDirty();
    }

    public function isLowStock(): bool
    {
        return $this->current_quantity <= $this->min_stock_level;
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function stockTransactions(): HasMany
    {
        return $this->hasMany(StockTransaction::class);
    }
}
