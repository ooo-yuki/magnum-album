-- 0025: gacha quests 42 — daily/weekly + comeback 7d
CREATE TABLE IF NOT EXISTS "magnum_gacha_quests" (
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "quest_id" text NOT NULL,
  "week_id" text NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "target" integer NOT NULL,
  "claimed" boolean DEFAULT false NOT NULL,
  "completed" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "quest_id", "week_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_gacha_quests_user" ON "magnum_gacha_quests" ("user_id", "week_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_comeback_claims" (
  "user_id" integer PRIMARY KEY REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "last_claim" timestamp DEFAULT now() NOT NULL,
  "claims" integer DEFAULT 0 NOT NULL
);
