-- 0012: mining exchange log + idea comments (без localStorage)
CREATE TABLE IF NOT EXISTS "magnum_mining_exchanges" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "mining_amount" integer NOT NULL CHECK ("mining_amount" > 0),
  "coins_amount" integer NOT NULL CHECK ("coins_amount" > 0),
  "rate" integer DEFAULT 10 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magnum_idea_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "idea_id" integer NOT NULL REFERENCES "magnum_ideas"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "body" text NOT NULL CHECK (char_length("body") >= 3 AND char_length("body") <= 400),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_mining_exchanges_user_idx" ON "magnum_mining_exchanges" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_idea_comments_idea_idx" ON "magnum_idea_comments" ("idea_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_idea_comments_created_idx" ON "magnum_idea_comments" ("created_at" DESC);
