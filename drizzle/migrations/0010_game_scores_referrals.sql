-- 0010 game_scores + referrals + duel_history: единый скоринга 42, реф-коды, история дуэлей
CREATE TABLE IF NOT EXISTS "magnum_game_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "game" text NOT NULL,
  "score" integer NOT NULL CHECK ("score" >= 0 AND "score" <= 999999),
  "coins_earned" integer DEFAULT 0 NOT NULL,
  "meta" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_game_scores_user_idx" ON "magnum_game_scores" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_game_scores_game_score_idx" ON "magnum_game_scores" ("game", "score" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_game_scores_game_created_idx" ON "magnum_game_scores" ("game", "created_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_referrals" (
  "id" serial PRIMARY KEY NOT NULL,
  "inviter_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "invited_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "reward_claimed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("invited_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_referrals_inviter_idx" ON "magnum_referrals" ("inviter_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_referrals_code_idx" ON "magnum_referrals" ("code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_duel_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "room_id" text NOT NULL,
  "winner" text,
  "scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "duration_sec" integer DEFAULT 10 NOT NULL,
  "player_count" integer DEFAULT 2 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_duel_history_created_idx" ON "magnum_duel_history" ("created_at" DESC);
