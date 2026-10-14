<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Create trigger function to block UPDATE and DELETE on immutable audit/ledger tables
        DB::unprepared("
            CREATE OR REPLACE FUNCTION prevent_immutable_table_modification()
            RETURNS TRIGGER AS \$\$
            BEGIN
                RAISE EXCEPTION 'Table % is strictly append-only. UPDATE and DELETE operations are prohibited by CAMMS compliance rules.', TG_TABLE_NAME;
            END;
            \$\$ LANGUAGE plpgsql;
        ");

        // 2. Bind trigger to activity_log
        DB::unprepared("
            CREATE TRIGGER trg_activity_log_immutable
            BEFORE UPDATE OR DELETE ON activity_log
            FOR EACH ROW
            EXECUTE FUNCTION prevent_immutable_table_modification();
        ");

        // 3. Bind trigger to depreciation_records
        DB::unprepared("
            CREATE TRIGGER trg_depreciation_records_immutable
            BEFORE UPDATE OR DELETE ON depreciation_records
            FOR EACH ROW
            EXECUTE FUNCTION prevent_immutable_table_modification();
        ");

        // 4. Bind trigger to stock_transactions
        DB::unprepared("
            CREATE TRIGGER trg_stock_transactions_immutable
            BEFORE UPDATE OR DELETE ON stock_transactions
            FOR EACH ROW
            EXECUTE FUNCTION prevent_immutable_table_modification();
        ");
    }

    public function down(): void
    {
        DB::unprepared("DROP TRIGGER IF EXISTS trg_stock_transactions_immutable ON stock_transactions;");
        DB::unprepared("DROP TRIGGER IF EXISTS trg_depreciation_records_immutable ON depreciation_records;");
        DB::unprepared("DROP TRIGGER IF EXISTS trg_activity_log_immutable ON activity_log;");
        DB::unprepared("DROP FUNCTION IF EXISTS prevent_immutable_table_modification();");
    }
};
