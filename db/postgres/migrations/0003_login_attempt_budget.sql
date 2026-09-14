CREATE TABLE "private_auth"."login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_attempts_window_index" ON "private_auth"."login_attempts" USING btree ("window_started_at");
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON private_auth.login_attempts TO camms_auth;
