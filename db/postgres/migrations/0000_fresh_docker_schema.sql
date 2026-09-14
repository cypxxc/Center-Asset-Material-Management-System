CREATE SCHEMA IF NOT EXISTS "private_auth";
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"target_table" text NOT NULL,
	"target_id" uuid,
	"old_data" jsonb,
	"new_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "private_auth"."credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_name" text NOT NULL,
	"item_type" text NOT NULL,
	"category_id" uuid,
	"location_id" uuid,
	"unit_id" uuid,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2),
	"asset_no" text,
	"serial_no" text,
	"brand" text,
	"model" text,
	"responsible_person" text,
	"status" text DEFAULT 'active' NOT NULL,
	"note" text,
	"image_url" text,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_by" uuid,
	"deleted_at" timestamp with time zone,
	"depreciation_enabled" boolean DEFAULT false NOT NULL,
	"depreciation_method" text,
	"depreciation_cost" numeric(12, 2),
	"depreciation_useful_life_years" integer,
	"depreciation_start_basis" text,
	"depreciation_start_date" date,
	"depreciation_residual_value" numeric(12, 2) DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "items_type_check" CHECK ("items"."item_type" in ('asset','material')),
	CONSTRAINT "items_status_check" CHECK ("items"."status" in ('active','spare','damaged','waiting_repair','inactive','disposed')),
	CONSTRAINT "items_quantity_check" CHECK ("items"."quantity" >= 0),
	CONSTRAINT "items_price_check" CHECK ("items"."unit_price" is null or "items"."unit_price" >= 0),
	CONSTRAINT "items_depreciation_check" CHECK (not "items"."depreciation_enabled" or ("items"."item_type"='asset' and "items"."depreciation_method"='straight_line' and "items"."depreciation_cost">1 and "items"."depreciation_useful_life_years">0 and "items"."depreciation_start_basis" in ('acquired','available','manual') and "items"."depreciation_start_date" is not null and "items"."depreciation_residual_value"=1))
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"building" text,
	"floor" text,
	"room" text,
	"department" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sidebar_order" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_role_check" CHECK ("profiles"."role" in ('admin','staff','viewer'))
);
--> statement-breakpoint
CREATE TABLE "private_auth"."sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_auth"."credentials" ADD CONSTRAINT "credentials_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_deleted_by_profiles_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private_auth"."sessions" ADD CONSTRAINT "sessions_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_index" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_target_index" ON "audit_logs" USING btree ("target_table","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "items_asset_no_unique" ON "items" USING btree ("asset_no") WHERE "items"."deleted_at" is null and "items"."asset_no" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "items_serial_no_unique" ON "items" USING btree ("serial_no") WHERE "items"."deleted_at" is null and "items"."serial_no" is not null;--> statement-breakpoint
CREATE INDEX "items_updated_index" ON "items" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "items_category_index" ON "items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "items_location_index" ON "items" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "items_type_status_index" ON "items" USING btree ("item_type","status");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_email_unique" ON "profiles" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "sessions_user_index" ON "private_auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expiry_index" ON "private_auth"."sessions" USING btree ("expires_at");
