<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;

class Category extends Model
{
    use LogsActivity;

    protected $fillable = ['name', 'type'];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()->logOnly(['name', 'type'])->logOnlyDirty();
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
