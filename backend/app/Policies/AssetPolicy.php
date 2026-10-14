<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Asset;

class AssetPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active;
    }

    public function view(User $user, Asset $asset): bool
    {
        return $user->is_active;
    }

    public function create(User $user): bool
    {
        return $user->isStaff();
    }

    public function update(User $user, Asset $asset): bool
    {
        return $user->isStaff();
    }

    public function delete(User $user, Asset $asset): bool
    {
        // Hard Rule: Only active Admin can soft-delete assets
        return $user->isAdmin();
    }

    public function forceDelete(User $user, Asset $asset): bool
    {
        // Hard Boundary: Permanent deletion is strictly forbidden
        return false;
    }
}
