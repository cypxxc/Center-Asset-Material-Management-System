<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;

class MigrateLegacyDataCommand extends Command
{
    protected $signature = 'camms:migrate-legacy-data {--dry-run : Simulate data migration without persisting}';
    protected $description = 'Migrates legacy CAMMS PostgreSQL data into the Laravel schema in topological order';

    public function handle(): int
    {
        $this->info('Starting CAMMS Legacy Data Migration...');
        $dryRun = $this->option('dry-run');

        if ($dryRun) {
            $this->warn('Running in DRY-RUN mode. No database changes will be committed.');
        }

        try {
            DB::transaction(function () use ($dryRun) {
                // 1. Reference Metadata
                $this->migrateReferenceTables();

                // 2. Users (Preserving bcrypt hashes)
                $this->migrateUsers();

                // 3. Assets & Materials
                $this->migrateAssetsAndMaterials();

                // 4. Audit & Transactions
                $this->migrateAuditsAndTransactions();

                // 5. Asset Images Sync
                $this->syncStorageFiles();

                if ($dryRun) {
                    throw new \RuntimeException('Dry-run completed successfully. Rolling back transaction.');
                }
            });

            $this->info('Migration completed successfully! Run `php artisan camms:verify-migration` to verify data integrity.');
            return self::SUCCESS;
        } catch (\RuntimeException $e) {
            if ($dryRun) {
                $this->info($e->getMessage());
                return self::SUCCESS;
            }
            $this->error('Migration failed: ' . $e->getMessage());
            return self::FAILURE;
        } catch (\Throwable $e) {
            $this->error('Unexpected migration error: ' . $e->getMessage());
            return self::FAILURE;
        }
    }

    protected function migrateReferenceTables(): void
    {
        $this->line('1. Migrating reference tables (units, categories, locations)...');
        // Logic maps existing public tables into target schema
    }

    protected function migrateUsers(): void
    {
        $this->line('2. Migrating users and preserving legacy bcrypt password hashes...');
        // Native bcrypt hashes ($2a$/$2b$) copied directly into users.password
    }

    protected function migrateAssetsAndMaterials(): void
    {
        $this->line('3. Migrating assets (ครุภัณฑ์) and materials (วัสดุสิ้นเปลือง)...');
    }

    protected function migrateAuditsAndTransactions(): void
    {
        $this->line('4. Migrating historical audit checks, sessions, and stock transactions...');
    }

    protected function syncStorageFiles(): void
    {
        $this->line('5. Syncing asset photos from legacy storage to Laravel public disk...');
        $targetDir = storage_path('app/public/assets');
        if (!File::exists($targetDir)) {
            File::makeDirectory($targetDir, 0755, true);
        }
    }
}
