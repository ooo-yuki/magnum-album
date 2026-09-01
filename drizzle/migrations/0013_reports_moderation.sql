-- 0013: reports + moderation log (без localStorage, Neon Lakebase)
CREATE TABLE IF NOT EXISTS "magnum_reports" (
  "id" serial PRIMARY KEY NOT NULL,
  "reporter_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "target_type" text NOT NULL CHECK ("target_type" IN ('idea','comment','profile','duel')),
  "target_id" integer NOT NULL CHECK ("target_id" > 0),
  "reason" text NOT NULL CHECK (char_length("reason") >= 3 AND char_length("reason") <= 64),
  "details" text CHECK (char_length("details") <= 300),
  "status" text DEFAULT 'pending' NOT NULL CHECK ("status" IN ('pending','reviewed','rejected','actioned')),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_moderation_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "actor_id" integer REFERENCES "magnum_users"("id") ON DELETE SET NULL,
  "action" text NOT NULL CHECK (char_length("action") >= 2 AND char_length("action") <= 32),
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_reports_reporter_idx" ON "magnum_reports" ("reporter_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_reports_status_idx" ON "magnum_reports" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_reports_target_idx" ON "magnum_reports" ("target_type", "target_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "magnum_reports_dedup_idx" ON "magnum_reports" ("reporter_id", "target_type", "target_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_moderation_log_created_idx" ON "magnum_moderation_log" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_moderation_log_action_idx" ON "magnum_moderation_log" ("action");
