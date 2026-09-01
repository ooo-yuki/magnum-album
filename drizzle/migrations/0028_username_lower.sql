-- 0028: username_lower column for case-insensitive uniqueness (backfill + unique)
ALTER TABLE "magnum_users" ADD COLUMN IF NOT EXISTS "username_lower" text;
--> statement-breakpoint
UPDATE "magnum_users" SET "username_lower" = LOWER("username") WHERE "username_lower" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "magnum_users_username_lower_col_unique" ON "magnum_users" ("username_lower");
--> statement-breakpoint
-- ensure LOWER(username) index still exists for legacy rows
CREATE UNIQUE INDEX IF NOT EXISTS "magnum_users_username_lower_unique" ON "magnum_users" (LOWER("username"));
