-- 0024: auth hardening — role + username normalization + indexes
ALTER TABLE "magnum_users" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user' NOT NULL;
--> statement-breakpoint
-- normalize existing role values and promote whitelisted admins
UPDATE "magnum_users" SET "role"='admin' WHERE LOWER("username") IN ('5opka','admin') AND ("role" IS NULL OR "role"='user');
--> statement-breakpoint
-- unique index on LOWER(username) for case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS "magnum_users_username_lower_unique" ON "magnum_users" (LOWER("username"));
