-- magnum_presave_clicks: presave click tracking — P1 drizzle migration (idempotent)
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
