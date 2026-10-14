<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DepreciationRecord extends Model
{
    protected $fillable = [
        'asset_id',
        'fiscal_year',
        'annual_depreciation',
        'accumulated_depreciation',
        'net_book_value',
    ];

    protected $casts = [
        'fiscal_year' => 'integer',
        'annual_depreciation' => 'decimal:2',
        'accumulated_depreciation' => 'decimal:2',
        'net_book_value' => 'decimal:2',
    ];

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
