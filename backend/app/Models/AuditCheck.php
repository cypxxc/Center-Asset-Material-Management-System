<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditCheck extends Model
{
    protected $fillable = [
        'audit_session_id',
        'asset_id',
        'status',
        'remarks',
        'checked_by',
        'checked_at',
    ];

    protected $casts = [
        'checked_at' => 'datetime',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(AuditSession::class, 'audit_session_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function inspector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }
}
