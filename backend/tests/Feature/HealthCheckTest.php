<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthCheckTest extends TestCase
{
    public function test_system_health_and_database_connection(): void
    {
        $response = $this->get('/api/health/status');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'status',
                'database',
                'app',
                'timestamp',
            ])
            ->assertJson([
                'status' => 'healthy',
            ]);
    }
}
