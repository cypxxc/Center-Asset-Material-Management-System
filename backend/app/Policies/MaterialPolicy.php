<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Material;

class MaterialPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active;
    }

    public function view(User $user, Material $material): bool
    {
        return $user->is_active;
    }

    public function create(User $user): bool
    {
        return $user->isStaff();
    }

    public function update(User $user, Material $material): bool
    {
        return $user->isStaff();
    }

    public function delete(User $user, Material $material): bool
    {
        return $user->isAdmin();
    }

    public function forceDelete(User $user, Material $material): bool
    {
        return false;
    }

    public function recordTransaction(User $user, Material $material): bool
    {
        return $user->isStaff();
    }
}
