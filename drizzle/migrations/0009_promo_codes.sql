-- magnum_promo_codes + redemptions: промокоды 42 (Neon, no localStorage)
CREATE TABLE IF NOT EXISTS "magnum_promo_codes" (
  "code" text PRIMARY KEY NOT NULL,
  "reward" integer NOT NULL,
  "max_uses" integer DEFAULT 1000,
  "uses" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_promo_redemptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id"),
  "code" text NOT NULL REFERENCES "magnum_promo_codes"("code"),
  "redeemed_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("user_id","code")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_promo_redemptions_user_idx" ON "magnum_promo_redemptions" ("user_id");
--> statement-breakpoint
INSERT INTO "magnum_promo_codes" ("code","reward","max_uses","uses") VALUES
  ('MAGNUM42', 42, 10000, 0),
  ('5OPKA', 42, 10000, 0),
  ('BRATUKHI', 84, 5000, 0),
  ('KUZYA', 142, 1000, 0),
  ('VIP42', 420, 142, 0)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_idea_bookmarks" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "idea_id" integer NOT NULL REFERENCES "magnum_ideas"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("user_id","idea_id")
);
CREATE INDEX IF NOT EXISTS "magnum_idea_bookmarks_user_idx" ON "magnum_idea_bookmarks" ("user_id");
CREATE INDEX IF NOT EXISTS "magnum_idea_bookmarks_idea_idx" ON "magnum_idea_bookmarks" ("idea_id");

