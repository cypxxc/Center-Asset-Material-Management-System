<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class Asset extends Model
{
    use SoftDeletes, LogsActivity;

    protected $fillable = [
        'asset_code',
        'serial_number',
        'name',
        'category_id',
        'location_id',
        'unit_id',
        'cost',
        'salvage_value',
        'useful_life_years',
        'acquisition_date',
        'status',
        'image_url',
    ];

    protected $casts = [
        'cost' => 'decimal:2',
        'salvage_value' => 'decimal:2',
        'useful_life_years' => 'integer',
        'acquisition_date' => 'date',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly([
                'asset_code',
                'serial_number',
                'name',
                'cost',
                'salvage_value',
                'status',
                'location_id',
                'category_id',
            ])
            ->logOnlyDirty();
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

    public function depreciationRecords(): HasMany
    {
        return $this->hasMany(DepreciationRecord::class);
    }

    public function auditChecks(): HasMany
    {
        return $this->hasMany(AuditCheck::class);
    }
}
