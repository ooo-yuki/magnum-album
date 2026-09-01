-- 0023: gacha/board race fix — tx + FOR UPDATE + ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS "magnum_board_shares_user_day_unique" ON "magnum_board_shares" ("user_id", "day_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_gacha_history" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "banner_type" text NOT NULL,
  "rarity" text NOT NULL,
  "cosmetic_id" text NOT NULL,
  "is_new" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gacha_history_user" ON "magnum_gacha_history" ("user_id", "created_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_gacha_free_rolls" (
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "day_id" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "day_id")
);
