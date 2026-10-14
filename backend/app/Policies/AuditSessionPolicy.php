<?php

namespace App\Policies;

use App\Models\User;
use App\Models\AuditSession;

class AuditSessionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active;
    }

    public function view(User $user, AuditSession $session): bool
    {
        return $user->is_active;
    }

    public function create(User $user): bool
    {
        return $user->isAdmin();
    }

    public function update(User $user, AuditSession $session): bool
    {
        return $user->isAdmin();
    }

    public function checkIn(User $user, AuditSession $session): bool
    {
        return $user->isStaff() && $session->isOpen();
    }
}
