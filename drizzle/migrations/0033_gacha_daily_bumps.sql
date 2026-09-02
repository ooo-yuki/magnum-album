-- 0033: gacha daily bumps — per-day dedup for weekly streak 7d (1 bump/day max)
CREATE TABLE IF NOT EXISTS "magnum_gacha_daily_bumps" (
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "week_id" text NOT NULL,
  "day_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "week_id", "day_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gacha_daily_bumps_user_week" ON "magnum_gacha_daily_bumps" ("user_id", "week_id");
