<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Asset;
use App\Policies\AssetPolicy;
use App\Services\UserService;
use DomainException;

class RbacAndAdminProtectionTest extends TestCase
{
    public function test_staff_cannot_delete_items(): void
    {
        $staff = new User(['role' => 'staff', 'is_active' => true]);
        $asset = new Asset();
        $policy = new AssetPolicy();

        $this->assertFalse($policy->delete($staff, $asset));
    }

    public function test_admin_can_delete_items_but_not_force_delete(): void
    {
        $admin = new User(['role' => 'admin', 'is_active' => true]);
        $asset = new Asset();
        $policy = new AssetPolicy();

        $this->assertTrue($policy->delete($admin, $asset));
        $this->assertFalse($policy->forceDelete($admin, $asset));
    }

    public function test_admin_cannot_demote_themselves(): void
    {
        $admin = new User(['id' => 1, 'role' => 'admin', 'is_active' => true]);
        $userService = new UserService();

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Administrators cannot demote their own account.');

        $userService->demoteAdmin($admin, $admin, 'staff');
    }
}
