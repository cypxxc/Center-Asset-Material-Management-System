<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

class InertiaPageRenderTest extends TestCase
{
    public function test_inertia_asset_index_renders_with_shared_user_and_permissions(): void
    {
        $user = new User([
            'id' => 1,
            'name' => 'สมชาย มั่นคง',
            'email' => 'somchai@camms.local',
            'role' => 'staff',
            'is_active' => true,
        ]);

        $this->actingAs($user);

        $response = $this->get('/assets');

        $response->assertStatus(200);
    }
}
