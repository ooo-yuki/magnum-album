-- 0015: duel wagers + mining boosts + invite status hardening + season top indexes
CREATE TABLE IF NOT EXISTS "magnum_duel_wagers" (
  "id" serial PRIMARY KEY NOT NULL,
  "room_id" text NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL CHECK ("amount" IN (42,142,420,1420)),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_mining_boosts" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "until" timestamp NOT NULL,
  "price" integer DEFAULT 142 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_duel_wagers_room_idx" ON "magnum_duel_wagers" ("room_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_duel_wagers_user_idx" ON "magnum_duel_wagers" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_mining_boosts_user_idx" ON "magnum_mining_boosts" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_duel_history_winner_idx" ON "magnum_duel_history" ("winner");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_duel_history_created_idx" ON "magnum_duel_history" ("created_at" DESC);
