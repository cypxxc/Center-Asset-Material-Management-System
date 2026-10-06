CREATE TABLE "private_auth"."rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX "rate_limits_window_index" ON "private_auth"."rate_limits" USING btree ("window_started_at");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON private_auth.rate_limits TO camms_auth;
