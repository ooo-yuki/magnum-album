-- 0029: daily claim double-claim guard — unique per user per calendar day (UTC)
ALTER TABLE "magnum_daily_claims" ADD COLUMN IF NOT EXISTS "claim_day" date;
--> statement-breakpoint
-- backfill from existing claimed_at
UPDATE "magnum_daily_claims" SET "claim_day" = ("claimed_at"::date) WHERE "claim_day" IS NULL;
--> statement-breakpoint
-- expression index as hard guard even for rows before backfill (covers app bugs)
CREATE UNIQUE INDEX IF NOT EXISTS "magnum_daily_claims_user_day_idx" ON "magnum_daily_claims" ("user_id", ("claimed_at"::date));
--> statement-breakpoint
-- column-based unique (preferred for app INSERT .. ON CONFLICT); keep both — column is explicit, expression is safety net
CREATE UNIQUE INDEX IF NOT EXISTS "magnum_daily_claims_user_day_unique" ON "magnum_daily_claims" ("user_id", "claim_day");
