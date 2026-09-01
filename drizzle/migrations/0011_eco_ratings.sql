-- 0011 eco_ratings: взвешенный рейтинг 0-10 по ECO-квизу + tiers
CREATE TABLE IF NOT EXISTS "magnum_eco_ratings" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer REFERENCES "magnum_users"("id") ON DELETE SET NULL,
  "player" text,
  "score" integer NOT NULL CHECK ("score" >= -1000 AND "score" <= 1000),
  "rating" integer NOT NULL CHECK ("rating" >= 0 AND "rating" <= 10),
  "tier" text NOT NULL,
  "answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_eco_ratings_score_idx" ON "magnum_eco_ratings" ("score" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_eco_ratings_rating_idx" ON "magnum_eco_ratings" ("rating" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_eco_ratings_created_idx" ON "magnum_eco_ratings" ("created_at" DESC);
