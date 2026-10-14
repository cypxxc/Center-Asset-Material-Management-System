<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class AuditSession extends Model
{
    use LogsActivity;

    protected $fillable = [
        'fiscal_year',
        'title',
        'status',
        'created_by',
    ];

    protected $casts = [
        'fiscal_year' => 'integer',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logOnly(['fiscal_year', 'title', 'status'])->logOnlyDirty();
    }

    public function isOpen(): bool
    {
        return $this->status === 'open';
    }

    public function checks(): HasMany
    {
        return $this->hasMany(AuditCheck::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
