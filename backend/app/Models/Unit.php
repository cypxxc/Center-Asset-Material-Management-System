<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class Unit extends Model
{
    use LogsActivity;

    protected $fillable = ['name'];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logOnly(['name'])->logOnlyDirty();
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class);
    }

    public function materials(): HasMany
    {
        return $this->hasMany(Material::class);
    }
}
