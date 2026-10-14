<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Support\Facades\Artisan;

class LegacyMigrationCommandTest extends TestCase
{
    public function test_etl_dry_run_executes_successfully(): void
    {
        $exitCode = Artisan::call('camms:migrate-legacy-data', ['--dry-run' => true]);

        $this->assertEquals(0, $exitCode);
    }

    public function test_verify_migration_command_runs(): void
    {
        $exitCode = Artisan::call('camms:verify-migration');

        $this->assertEquals(0, $exitCode);
    }
}
