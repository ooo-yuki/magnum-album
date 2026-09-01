-- 0018: fix magnum_subscriptions — add ends_at + started_at (was created with old 4-col schema user_id/pk tier expires_at created_at, missing drizzle id/started_at/ends_at)
ALTER TABLE "magnum_subscriptions" ADD COLUMN IF NOT EXISTS "started_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "magnum_subscriptions" ADD COLUMN IF NOT EXISTS "ends_at" timestamp;
--> statement-breakpoint
-- backfill ends_at from old expires_at where possible
UPDATE "magnum_subscriptions" SET "ends_at" = "expires_at" WHERE "ends_at" IS NULL AND "expires_at" IS NOT NULL;
--> statement-breakpoint
-- id column missing in old table (pk was user_id) — add for drizzle schema alignment, keep existing pk
ALTER TABLE "magnum_subscriptions" ADD COLUMN IF NOT EXISTS "id" serial;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_magnum_subscriptions_user" ON "magnum_subscriptions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_magnum_subscriptions_ends_at" ON "magnum_subscriptions" ("ends_at");
