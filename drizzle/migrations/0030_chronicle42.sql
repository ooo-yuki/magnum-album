-- 0030 chronicle 42: progress + shares
CREATE TABLE IF NOT EXISTS "magnum_chronicle_progress" (
  "user_id" integer PRIMARY KEY REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "unlocked" integer[] NOT NULL DEFAULT ARRAY[1,2,3],
  "xp_spent" integer NOT NULL DEFAULT 0,
  "completed" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "magnum_chronicle_shares" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id") ON DELETE CASCADE,
  "chapter" integer NOT NULL,
  "day" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE("user_id","day")
);
CREATE INDEX IF NOT EXISTS "magnum_chronicle_shares_day_idx" ON "magnum_chronicle_shares" ("day");
