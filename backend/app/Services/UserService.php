<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use DomainException;

class UserService
{
    /**
     * Deactivates a user with concurrency-safe admin verification.
     */
    public function deactivateUser(User $actor, User $target): void
    {
        if ($actor->id === $target->id) {
            throw new DomainException('Administrators cannot deactivate their own account.');
        }

        DB::transaction(function () use ($target) {
            if ($target->role === 'admin') {
                $activeAdminCount = User::where('role', 'admin')
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->count();

                if ($activeAdminCount <= 1) {
                    throw new DomainException('Cannot deactivate the last active system administrator.');
                }
            }

            $target->update(['is_active' => false]);
        });
    }

    /**
     * Demotes an admin user with concurrency-safe verification.
     */
    public function demoteAdmin(User $actor, User $target, string $newRole): void
    {
        if ($actor->id === $target->id) {
            throw new DomainException('Administrators cannot demote their own account.');
        }

        DB::transaction(function () use ($target, $newRole) {
            $activeAdminCount = User::where('role', 'admin')
                ->where('is_active', true)
                ->lockForUpdate()
                ->count();

            if ($activeAdminCount <= 1) {
                throw new DomainException('Cannot demote the last active system administrator.');
            }

            $target->update(['role' => $newRole]);
        });
    }
}
