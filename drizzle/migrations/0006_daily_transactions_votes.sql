-- magnum_daily_claims: streak + daily 42 coins
CREATE TABLE IF NOT EXISTS "magnum_daily_claims" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id"),
  "claimed_at" timestamp DEFAULT now() NOT NULL,
  "streak" integer DEFAULT 1 NOT NULL,
  "reward" integer DEFAULT 42 NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_daily_claims_user_idx" ON "magnum_daily_claims" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_daily_claims_claimed_idx" ON "magnum_daily_claims" ("claimed_at");
--> statement-breakpoint
-- magnum_transactions: ledger coins in/out
CREATE TABLE IF NOT EXISTS "magnum_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id"),
  "amount" integer NOT NULL,
  "reason" text NOT NULL,
  "meta" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_transactions_user_idx" ON "magnum_transactions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_transactions_created_idx" ON "magnum_transactions" ("created_at");
--> statement-breakpoint
-- magnum_idea_votes: dedup per user per idea
CREATE TABLE IF NOT EXISTS "magnum_idea_votes" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "magnum_users"("id"),
  "idea_id" integer NOT NULL REFERENCES "magnum_ideas"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("user_id","idea_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "magnum_idea_votes_idea_idx" ON "magnum_idea_votes" ("idea_id");
