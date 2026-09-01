-- 0017: ai guard — rateLimit + ledger for /magnum/api/ai (anon 8/min, image requires auth)
CREATE TABLE IF NOT EXISTS "magnum_ai_usage" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer REFERENCES "magnum_users"("id") ON DELETE SET NULL,
  "ip" text NOT NULL,
  "has_image" boolean DEFAULT false NOT NULL,
  "model" text DEFAULT 'mimo-v2.5' NOT NULL,
  "tokens_requested" integer DEFAULT 400 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_ai_usage_user_idx" ON "magnum_ai_usage" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_ai_usage_ip_idx" ON "magnum_ai_usage" ("ip");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_ai_usage_created_idx" ON "magnum_ai_usage" ("created_at" DESC);
