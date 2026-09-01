-- magnum_presave_clicks: presave click tracking (user_id nullable for anon) + ip + url
CREATE TABLE IF NOT EXISTS "magnum_presave_clicks" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer REFERENCES "magnum_users"("id"),
  "url" text DEFAULT '/magnum',
  "ip" text,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_presave_clicks_user_id_idx" ON "magnum_presave_clicks" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_presave_clicks_created_at_idx" ON "magnum_presave_clicks" ("created_at");
--> statement-breakpoint
-- magnum_cosmetics: ensure table exists (added in schema 2026-09-01)
CREATE TABLE IF NOT EXISTS "magnum_cosmetics" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer REFERENCES "magnum_users"("id"),
  "cosmetic_id" text NOT NULL,
  "slot" text NOT NULL,
  "equipped" boolean DEFAULT false,
  "purchased_at" timestamp DEFAULT now()
);
