<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Users
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->enum('role', ['admin', 'staff', 'viewer'])->default('viewer');
            $table->boolean('is_active')->default(true);
            $table->rememberToken();
            $table->timestamps();
        });

        // 2. Categories
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['asset', 'material'])->default('asset');
            $table->timestamps();
        });

        // 3. Locations
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('building')->nullable();
            $table->string('floor')->nullable();
            $table->string('room')->nullable();
            $table->timestamps();
        });

        // 4. Units
        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });

        // 5. Assets (ครุภัณฑ์) with SoftDeletes
        Schema::create('assets', function (Blueprint $table) {
            $table->id();
            $table->string('asset_code');
            $table->string('serial_number')->nullable();
            $table->string('name');
            $table->foreignId('category_id')->constrained('categories')->cascadeOnDelete();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->foreignId('unit_id')->constrained('units')->cascadeOnDelete();
            $table->decimal('cost', 15, 2);
            $table->decimal('salvage_value', 15, 2)->default(1.00);
            $table->unsignedInteger('useful_life_years')->default(5);
            $table->date('acquisition_date');
            $table->string('status')->default('active');
            $table->string('image_url')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        // PostgreSQL Partial Unique Index on active asset_code
        DB::statement('CREATE UNIQUE INDEX assets_asset_code_unique_active ON assets (asset_code) WHERE deleted_at IS NULL;');

        // 6. Materials (วัสดุสิ้นเปลือง) with SoftDeletes
        Schema::create('materials', function (Blueprint $table) {
            $table->id();
            $table->string('sku');
            $table->string('name');
            $table->foreignId('category_id')->constrained('categories')->cascadeOnDelete();
            $table->foreignId('location_id')->constrained('locations')->cascadeOnDelete();
            $table->foreignId('unit_id')->constrained('units')->cascadeOnDelete();
            $table->decimal('unit_price', 15, 2)->default(0.00);
            $table->unsignedInteger('current_quantity')->default(0);
            $table->unsignedInteger('min_stock_level')->default(5);
            $table->softDeletes();
            $table->timestamps();
        });

        // PostgreSQL Partial Unique Index on active sku
        DB::statement('CREATE UNIQUE INDEX materials_sku_unique_active ON materials (sku) WHERE deleted_at IS NULL;');

        // 7. Stock Transactions (Append-Only ledger for materials)
        Schema::create('stock_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('material_id')->constrained('materials')->cascadeOnDelete();
            $table->enum('type', ['IN', 'OUT', 'ADJUST']);
            $table->integer('quantity');
            $table->decimal('unit_price', 15, 2)->default(0.00);
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // 8. Depreciation Records (Append-Only ledger for assets)
        Schema::create('depreciation_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->unsignedSmallInteger('fiscal_year');
            $table->decimal('annual_depreciation', 15, 2);
            $table->decimal('accumulated_depreciation', 15, 2);
            $table->decimal('net_book_value', 15, 2);
            $table->timestamps();

            $table->unique(['asset_id', 'fiscal_year'], 'depreciation_asset_fiscal_unique');
        });

        // 9. Audit Sessions (Fiscal Year physical check-in cycle)
        Schema::create('audit_sessions', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('fiscal_year');
            $table->string('title');
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });

        // 10. Audit Checks (Single check per asset per session)
        Schema::create('audit_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('audit_session_id')->constrained('audit_sessions')->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->enum('status', ['found', 'damaged', 'missing', 'relocated'])->default('found');
            $table->text('remarks')->nullable();
            $table->foreignId('checked_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('checked_at')->useCurrent();
            $table->timestamps();

            $table->unique(['audit_session_id', 'asset_id'], 'audit_checks_session_asset_unique');
        });

        // 11. Activity Log (Spatie Activity Log table)
        Schema::create('activity_log', function (Blueprint $table) {
            $table->id();
            $table->string('log_name')->nullable();
            $table->text('description');
            $table->nullableMorphs('subject', 'subject');
            $table->nullableMorphs('causer', 'causer');
            $table->json('properties')->nullable();
            $table->string('event')->nullable();
            $table->uuid('batch_uuid')->nullable();
            $table->timestamps();

            $table->index('log_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_log');
        Schema::dropIfExists('audit_checks');
        Schema::dropIfExists('audit_sessions');
        Schema::dropIfExists('depreciation_records');
        Schema::dropIfExists('stock_transactions');
        Schema::dropIfExists('materials');
        Schema::dropIfExists('assets');
        Schema::dropIfExists('units');
        Schema::dropIfExists('locations');
        Schema::dropIfExists('categories');
        Schema::dropIfExists('users');
    }
};
