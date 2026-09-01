-- 0014: duel seasons + invites (WS duel 2-4 realtime, spectator, ready)
CREATE TABLE IF NOT EXISTS "magnum_duel_seasons" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "starts_at" timestamp DEFAULT now() NOT NULL,
  "ends_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_duel_invites" (
  "id" serial PRIMARY KEY NOT NULL,
  "from_user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "to_user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "room_id" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL CHECK ("status" IN ('pending','accepted','declined','expired')),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_duel_invites_to_idx" ON "magnum_duel_invites" ("to_user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_duel_invites_from_idx" ON "magnum_duel_invites" ("from_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_duel_invites_room_idx" ON "magnum_duel_invites" ("room_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_duel_seasons_starts_idx" ON "magnum_duel_seasons" ("starts_at" DESC);
